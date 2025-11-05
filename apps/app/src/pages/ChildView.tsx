import { useUser } from "../lib/auth";
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Calendar, School, CheckCircle, XCircle, RefreshCw, User, FileText, BarChart3 } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useParentDataQuery } from '@/hooks/useParentDataQuery';
import { usePronoteConnections, useInvalidatePronoteConnections, type PronoteConnection } from '@/hooks/usePronoteConnections';
import ConnectPronote from '@/components/modals/ConnectPronote';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { IChild } from '@/types';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';

// ===== MODERN UI COMPONENTS =====

const PronoteSection: React.FC<{
 child: IChild;
 connections: PronoteConnection[];
 onConnect: () => void;
 onRefresh: () => void;
 loading: boolean;
}> = ({ child, connections, onConnect, onRefresh, loading }) => {
 const activeConnection = connections.find(c => c.isActive);

 return (
 <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
 <CardHeader className="border-b border-border">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-primary/10 rounded-xl">
 <School className="w-5 h-5 text-primary" />
 </div>
 <div>
 <CardTitle className="text-lg font-semibold">Pronote</CardTitle>
 <p className="text-sm text-muted-foreground">Données scolaires officielles</p>
 </div>
 </div>
 <Button
 variant="ghost"
 size="icon"
 onClick={onRefresh}
 disabled={loading}
 title="Actualiser"
 className="hover:bg-primary/10 text-primary"
 >
 <RefreshCw className={`w-4 h-4 ${
 loading ? 'animate-spin' : ''
 }`} />
 </Button>
 </div>
 </CardHeader>

 <CardContent>
 {activeConnection ? (
 <div className="space-y-4">
 <div className="flex items-center justify-between p-6 bg-success/10 rounded-xl border border-success/20">
 <div className="flex items-center gap-4">
 <CheckCircle className="w-5 h-5 text-success" />
 <div>
 <p className="font-semibold text-success">
 {activeConnection.establishmentName}
 </p>
 <p className="text-sm text-success">
 Compte: {activeConnection.username}
 </p>
 {activeConnection.lastSync && (
 <p className="text-xs text-success mt-1">
 Synchronisé le {new Date(activeConnection.lastSync).toLocaleDateString('fr-FR')}
 </p>
 )}
 </div>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={onConnect}
 className="text-success border-success/20 hover:bg-success/5"
 >
 Gérer
 </Button>
 </div>

 {/* Actions rapides */}
 <div className="grid grid-cols-3 gap-3">
 <Button variant="outline" className="flex-col h-auto p-6 border-primary/30 hover:bg-primary/10">
 <BarChart3 className="w-4 h-4 mb-2 text-primary" />
 <span className="text-sm font-medium">Notes</span>
 </Button>
 <Button variant="outline" className="flex-col h-auto p-6 border-primary/30 hover:bg-primary/10">
 <Calendar className="w-4 h-4 mb-2 text-primary" />
 <span className="text-sm font-medium">EDT</span>
 </Button>
 <Button variant="outline" className="flex-col h-auto p-6 border-primary/30 hover:bg-primary/10">
 <FileText className="w-4 h-4 mb-2 text-primary" />
 <span className="text-sm font-medium">Devoirs</span>
 </Button>
 </div>
 </div>
 ) : (
 <div className="text-center py-8">
 <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center">
 <XCircle className="w-8 h-8 text-primary" />
 </div>
 <h4 className="text-lg font-semibold mb-2 text-foreground">
 Connexion Pronote requise
 </h4>
 <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
 La connexion Pronote sera bientôt disponible pour synchroniser les notes, devoirs et emploi du temps de {child.firstName}.
 </p>
 <Button disabled className="opacity-50 cursor-not-allowed">
 Bientôt disponible
 </Button>
 </div>
 )}
 </CardContent>
 </Card>
 );
};

// ===== MAIN COMPONENT =====

export default function ChildView(): React.ReactElement {
 const { childId } = useParams<{ childId: string }>();
 const navigate = useNavigate();
 const user = useUser();

 // TanStack Query pour les données parent
 const { dashboardData, isLoading: _parentLoading } = useParentDataQuery();
 const children = useMemo(() => dashboardData?.children ?? [], [dashboardData?.children]);

 // State local
 const [child, setChild] = useState<IChild | null>(null);
 const [showPronoteModal, setShowPronoteModal] = useState(false);

 // Hooks TanStack Query spécialisés
 const { data: pronoteConnections = [], isLoading: pronoteLoading, refetch: refetchPronote } = usePronoteConnections(child?.id);
 const invalidatePronoteConnections = useInvalidatePronoteConnections();

 // Effet pour identifier l'enfant courant
 useEffect(() => {
 if (!childId || !user) return;

 const foundChild = [...(children ?? []), ...(dashboardData?.children ?? [])].find(
 c => c.id === childId || c.username === childId
 );

 if (!foundChild && !_parentLoading) {
  void navigate('/parent/children/manage');
 return;
 }

 if (foundChild) {
 setChild(foundChild);
 }
 }, [childId, user, children, dashboardData?.children, _parentLoading, navigate]);

 // Handlers
 const handlePronoteConnect = () => {
 setShowPronoteModal(true);
 };

 const handlePronoteSuccess = () => {
 setShowPronoteModal(false);
 // Invalider les queries pour recharger les données
 invalidatePronoteConnections(child?.id);
 };

 const handleRefreshPronote = () => {
 void refetchPronote();
 };

 // Loading state
 if (!child || _parentLoading) {
 return (
 <PageContainer>
 <LoadingState variant="page" />
 </PageContainer>
 );
 }

 return (
 <PageContainer>
 {/* Header simple et cohérent */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
 <div className="flex items-center gap-4">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => navigate('/parent')}
 className="hover:bg-primary/10 text-primary"
 >
 <ArrowLeft className="w-5 h-5" />
 </Button>

 <Avatar className="w-14 h-14 ring-2 ring-background shadow-lg">
 <AvatarFallback className="bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground">
 <User className="w-6 h-6" />
 </AvatarFallback>
 </Avatar>
 <div>
 <h1 className="text-3xl md:text-4xl font-bold text-foreground">
 {child.firstName} {child.lastName}
 </h1>
 <p className="text-muted-foreground mt-1">
 {child.schoolLevel} • @{child.username}
 </p>
 </div>
 </div>
 </div>

 {/* Section Pronote uniquement */}
 <PronoteSection
 child={child}
 connections={pronoteConnections}
 onConnect={handlePronoteConnect}
 onRefresh={handleRefreshPronote}
 loading={pronoteLoading}
 />

 {/* Modal Pronote */}
 {showPronoteModal && (
 <ConnectPronote
 isOpen={true}
 onClose={() => setShowPronoteModal(false)}
 onSuccess={handlePronoteSuccess}
 child={child}
 />
 )}
 </PageContainer>
 );
}
