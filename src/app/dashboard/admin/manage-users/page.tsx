
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getAllUsers, updateUserRoleAndPermissionsFS, deleteUserAndProfileFS } from '@/lib/firebase/firestore';
import type { UserProfile, Role } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, UserCog, Users, ShieldAlert, ShieldQuestion, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Removed AlertDialogTrigger as it's used with asChild

export default function ManageUsersPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actionUser, setActionUser] = useState<UserProfile | null>(null);
  const [dialogAction, setDialogAction] = useState<'promoteAdmin' | 'demoteAdmin' | 'promoteSuper' | 'demoteSuper' | 'deleteUser' | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);


  useEffect(() => {
    if (initialLoadComplete && !authLoading) {
      // Allow ADMIN_FACULTY to access this page, not just super admins, for deletion.
      // Super admin specific actions (promote/demote super) will be conditionally rendered.
      if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
        toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
        router.push('/dashboard');
      } else {
        fetchUsers();
      }
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const fetchedUsers = await getAllUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Could not fetch users.", variant: "destructive" });
    } finally {
      setLoadingUsers(false);
    }
  };

  const openConfirmationDialog = (user: UserProfile, action: 'promoteAdmin' | 'demoteAdmin' | 'promoteSuper' | 'demoteSuper' | 'deleteUser') => {
    if (user.email === 'pranavrathi07@gmail.com' && (action === 'demoteAdmin' || action === 'demoteSuper' || action === 'deleteUser')) {
        toast({title: "Action Restricted", description: "The primary super admin account cannot be modified or deleted.", variant: "default"});
        return;
    }
    setActionUser(user);
    setDialogAction(action);
    setIsConfirmDialogOpen(true);
  };
  
  const handleUserAction = async () => {
    if (!actionUser || !dialogAction) return;

    setIsConfirmDialogOpen(false); // Close dialog before async action

    if (dialogAction === 'deleteUser') {
        try {
            await deleteUserAndProfileFS(actionUser.uid);
            toast({ title: "User Profile Deleted", description: `Profile for ${actionUser.displayName || actionUser.email} has been deleted.` });
            fetchUsers(); // Refresh the list
        } catch (error: any) {
            console.error("Error deleting user profile:", error);
            toast({ title: "Delete Error", description: error.message || "Could not delete user profile.", variant: "destructive" });
        }
    } else {
        // Handle role changes
        let newRole: Role = actionUser.role;
        let newIsSuperAdmin: boolean | undefined = actionUser.isSuperAdmin;

        switch (dialogAction) {
        case 'promoteAdmin':
            newRole = 'ADMIN_FACULTY';
            break;
        case 'demoteAdmin':
            newRole = actionUser.email?.endsWith('@paruluniversity.ac.in') ? 'STUDENT' : 'EXTERNAL_USER';
            newIsSuperAdmin = false; 
            break;
        case 'promoteSuper':
            newRole = 'ADMIN_FACULTY'; 
            newIsSuperAdmin = true;
            break;
        case 'demoteSuper':
            newIsSuperAdmin = false;
            break;
        }

        try {
            await updateUserRoleAndPermissionsFS(actionUser.uid, newRole, newIsSuperAdmin);
            toast({ title: "Success", description: `${actionUser.displayName || actionUser.email}'s permissions updated.` });
            fetchUsers(); 
        } catch (error: any) {
            console.error("Error updating user role:", error);
            toast({ title: "Update Error", description: error.message || "Could not update user permissions.", variant: "destructive" });
        }
    }
    
    setActionUser(null);
    setDialogAction(null);
  };

  const getRoleBadge = (role: Role, isSuperAdmin?: boolean) => {
    if (isSuperAdmin) return <Badge variant="destructive" className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1"><ShieldAlert className="h-3 w-3" />Super Admin</Badge>;
    switch (role) {
      case 'ADMIN_FACULTY': return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-1"><UserCog className="h-3 w-3" />Admin</Badge>;
      case 'STUDENT': return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">Student</Badge>;
      case 'EXTERNAL_USER': return <Badge variant="outline">External</Badge>;
      default: return <Badge variant="outline" className="flex items-center gap-1"><ShieldQuestion className="h-3 w-3" />N/A</Badge>;
    }
  };
  
  const getDialogDescription = () => {
    if (!actionUser || !dialogAction) return "";
    const userName = actionUser.displayName || actionUser.email;
    switch (dialogAction) {
        case 'promoteAdmin': return `Promote ${userName} to Administrator? They will gain access to admin functionalities.`;
        case 'demoteAdmin': return `Demote ${userName} from Administrator? Their role will revert and they will lose admin access. If they were a Super Admin, this status will also be removed.`;
        case 'promoteSuper': return `Promote ${userName} to Super Admin? They must already be an Admin. They will gain full system control.`;
        case 'demoteSuper': return `Demote ${userName} from Super Admin? Their role will remain Administrator, but they will lose super admin privileges.`;
        case 'deleteUser': return `Delete user profile for ${userName}? This action removes their data from the system but does NOT delete their login account. This cannot be undone.`;
        default: return "Are you sure you want to proceed with this action?";
    }
  }


  if (authLoading || !initialLoadComplete || loadingUsers) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }

  if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Access Denied. Redirecting...</p></div>;
  }
  
  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
       <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <Users className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Manage Users</h1>
            <p className="text-muted-foreground">Oversee user roles and permissions across the portal.</p>
          </div>
        </div>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Portal Users</CardTitle>
          <CardDescription>View and manage roles for all registered users. Be cautious with permission changes.</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden sm:table-cell">Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium max-w-xs truncate" title={u.displayName || u.email || u.uid}>{u.displayName || u.email}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {getRoleBadge(u.role, u.isSuperAdmin)}
                      </TableCell>
                      <TableCell className="text-right space-x-1 sm:space-x-2">
                        {u.email !== 'pranavrathi07@gmail.com' && userProfile.isSuperAdmin && ( // Super admin actions only for super admins
                            <>
                            {u.role !== 'ADMIN_FACULTY' && (
                                <Button variant="outline" size="sm" onClick={() => openConfirmationDialog(u, 'promoteAdmin')}>Promote to Admin</Button>
                            )}
                            {u.role === 'ADMIN_FACULTY' && !u.isSuperAdmin && (
                                <Button variant="outline" size="sm" onClick={() => openConfirmationDialog(u, 'promoteSuper')}>To Super Admin</Button>
                            )}
                            {u.role === 'ADMIN_FACULTY' && u.isSuperAdmin && (
                                <Button variant="destructive" size="sm" onClick={() => openConfirmationDialog(u, 'demoteSuper')}>Demote Super</Button>
                            )}
                            {u.role === 'ADMIN_FACULTY' && ( 
                                <Button variant="destructive" size="sm" onClick={() => openConfirmationDialog(u, 'demoteAdmin')}>Demote Admin</Button>
                            )}
                            </>
                        )}
                        {u.email !== 'pranavrathi07@gmail.com' && ( // Delete button available for all admins for non-primary super admin users
                           <Button variant="destructive" size="sm" onClick={() => openConfirmationDialog(u, 'deleteUser')} className="ml-2">
                             <Trash2 className="h-4 w-4 mr-1 sm:mr-2" /> Delete
                           </Button>
                        )}
                        {u.email === 'pranavrathi07@gmail.com' && <Badge variant="default">Primary Super Admin</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action: {dialogAction?.replace(/([A-Z])/g, ' $1').trim()}</AlertDialogTitle>
            <AlertDialogDescription>
                {getDialogDescription()}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setActionUser(null); setDialogAction(null); setIsConfirmDialogOpen(false);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUserAction} className={(dialogAction?.includes('demote') || dialogAction === 'deleteUser') ? "bg-destructive hover:bg-destructive/90" : ""}>
                Proceed
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

