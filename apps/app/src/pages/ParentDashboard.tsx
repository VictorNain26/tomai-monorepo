import { useUser } from "../lib/auth";
import { useNavigate } from 'react-router';
import { Plus, Users, CreditCard, Crown } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParentDataQuery } from '@/hooks/useParentDataQuery';
import { ChildrenTable } from '@/components/tables/ChildrenTable';
import CreateChildModal from '@/components/modals/CreateChildModal';
import EditChildModal from '@/components/modals/EditChildModal';
import DeleteChildModal from '@/components/modals/DeleteChildModal';
import { ChildUsageCard } from '@/components/subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type IChild, isITomUser } from '@/types';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';

export default function ParentDashboard() {
  const user = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { children: parentChildren, isLoading, isError } = useParentDataQuery();
  const [modal, setModal] = useState<{
    _type: 'create' | 'edit' | 'delete' | null;
    child?: IChild;
  }>({ _type: null });

  const handleAddChild = () => {
    setModal({ _type: 'create' });
  };

  const handleViewChildDetails = (child: IChild) => {
    void navigate(`/parent/children/${child.id}`);
  };

  const handleSuccess = () => {
    setModal({ _type: null });
  };

  // Loading state
  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
      </PageContainer>
    );
  }

  // Error state
  if (isError) {
    return (
      <PageContainer>
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">
              Erreur lors du chargement des données
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['parent'] })}
            >
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const children = parentChildren ?? [];

  // Normal state
  return (
    <PageContainer>
      {/* Header simple et aéré */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Bonjour {(isITomUser(user) && user.firstName) ?? user?.name}
        </h1>
        <p className="text-muted-foreground mt-2">
          Gérez les comptes de vos enfants et suivez leur apprentissage
        </p>
      </div>

      {/* Gestion des enfants - Section principale */}
      <Card className="shadow-sm">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl md:text-2xl font-bold text-foreground">
                  Mes enfants
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {children.length} {children.length === 1 ? 'enfant inscrit' : 'enfants inscrits'}
                </p>
              </div>
            </div>

            <Button
              onClick={handleAddChild}
              size="lg"
              className="gap-2 shadow-lg hover:scale-105 transition-transform"
            >
              <Plus className="h-5 w-5" />
              Ajouter un enfant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ChildrenTable
            data={children}
            onEdit={(child) => setModal({ _type: 'edit', child })}
            onDelete={(child) => setModal({ _type: 'delete', child })}
            onView={handleViewChildDetails}
          />
        </CardContent>
      </Card>

      {/* Section Abonnement et Usage */}
      <Card className="shadow-sm mt-6">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-xl md:text-2xl font-bold text-foreground">
                  Abonnement & Usage
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Suivez l'utilisation de l'IA par vos enfants
                </p>
              </div>
            </div>

            <Button
              onClick={() => void navigate('/subscription/manage')}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <CreditCard className="h-5 w-5" />
              Gérer l'abonnement
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {children.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Ajoutez un enfant pour voir son utilisation de l'IA
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {children.map((child) => (
                <ChildUsageCard key={child.id} child={child} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales de gestion des enfants */}
      <CreateChildModal
        isOpen={modal._type === 'create'}
        onClose={() => setModal({ _type: null })}
        onSuccess={handleSuccess}
      />

      {modal._type === 'edit' && modal.child && (
        <EditChildModal
          isOpen={true}
          onClose={() => setModal({ _type: null })}
          child={modal.child}
          onSuccess={handleSuccess}
        />
      )}

      {modal._type === 'delete' && modal.child && (
        <DeleteChildModal
          isOpen={true}
          child={modal.child}
          onClose={() => setModal({ _type: null })}
          onDelete={handleSuccess}
        />
      )}
    </PageContainer>
  );
}
