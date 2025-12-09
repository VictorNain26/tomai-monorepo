import React, { useState, useEffect } from 'react';
import { School, CheckCircle, Loader2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import type { IChild } from '@/types';
import { useUser } from '@/lib/auth';

interface ConnectPronoteProps {
  isOpen: boolean;
  onClose: () => void;
  child: IChild;
  onSuccess: () => void;
}

type ModalStep = 'search' | 'credentials' | 'connecting' | 'success';

const ConnectPronote: React.FC<ConnectPronoteProps> = ({
  isOpen,
  onClose,
  child,
  onSuccess
}) => {
  const _user = useUser();

  // États principaux
  const [currentStep, setCurrentStep] = useState<ModalStep>('search');
  const [selectedEstablishment, setSelectedEstablishment] = useState<{
    name: string;
    city: string;
    url: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // États pour la recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // États pour l'authentification
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Réinitialisation
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('search');
      setSelectedEstablishment(null);
      setError(null);
      setSearchQuery('');
      setUsername('');
      setPassword('');
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);

    try {
      // Simulation d'une recherche d'établissement
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Exemple d'établissement trouvé
      const mockEstablishment = {
        name: searchQuery.includes('lycée') ? `Lycée ${searchQuery}` : `Collège ${searchQuery}`,
        city: 'Paris',
        url: 'https://exemple.pronote.net'
      };

      setSelectedEstablishment(mockEstablishment);
      setCurrentStep('credentials');
    } catch {
      setError('Établissement non trouvé');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConnect = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Veuillez saisir vos identifiants');
      return;
    }

    setCurrentStep('connecting');
    setError(null);

    try {
      // Simulation de la connexion
      await new Promise(resolve => setTimeout(resolve, 2000));

      setCurrentStep('success');

      // Succès après 1 seconde
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch {
      setError('Identifiants incorrects');
      setCurrentStep('credentials');
    }
  };

  const renderSearchStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
          <School className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm text-primary/70 font-medium">
          Recherchez l'établissement scolaire de {child.firstName}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="establishment" className="text-primary font-semibold">
            Nom de l'établissement
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary/60" />
            <Input
              id="establishment"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: Lycée Victor Hugo Paris"
              className="pl-10 border-primary/20 focus:border-primary focus:ring-primary/20 bg-primary/5"
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-2 pt-6 border-t border-primary/10 sm:flex-row sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full border-primary/30 text-primary hover:bg-primary/10 sm:w-auto sm:flex-1"
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isSearching}
            className="w-full sm:w-auto sm:flex-1"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Recherche...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Rechercher
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderCredentialsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-success/20">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <p className="text-sm font-semibold text-primary">
          {selectedEstablishment?.name}
        </p>
        <p className="text-xs text-primary/60 mt-1">Établissement trouvé</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pronote-username" className="text-primary font-semibold">
            Nom d'utilisateur Pronote
          </Label>
          <Input
            id="pronote-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nom d'utilisateur"
            className="border-primary/20 focus:border-primary focus:ring-primary/20 bg-primary/5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pronote-password" className="text-primary font-semibold">
            Mot de passe Pronote
          </Label>
          <Input
            id="pronote-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="border-primary/20 focus:border-primary focus:ring-primary/20 bg-primary/5"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-2 pt-6 border-t border-primary/10 sm:flex-row sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentStep('search')}
            className="w-full border-primary/30 text-primary hover:bg-primary/10 sm:w-auto sm:flex-1"
          >
            Retour
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConnect}
            disabled={!username.trim() || !password.trim()}
            className="w-full sm:w-auto sm:flex-1"
          >
            Se connecter
          </Button>
        </div>
      </div>
    </div>
  );

  const renderConnectingStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <p className="text-sm text-primary/70 font-medium">
          Vérification des identifiants avec Pronote
        </p>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-success/20">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <p className="text-sm font-semibold text-primary">
          Connexion réussie !
        </p>
        <p className="text-xs text-primary/70 mt-1">
          Le compte Pronote de {child.firstName} est maintenant connecté
        </p>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentStep) {
      case 'search':
        return renderSearchStep();
      case 'credentials':
        return renderCredentialsStep();
      case 'connecting':
        return renderConnectingStep();
      case 'success':
        return renderSuccessStep();
      default:
        return renderSearchStep();
    }
  };

  const getTitle = () => {
    switch (currentStep) {
      case 'search':
        return 'Connecter le compte Pronote';
      case 'credentials':
        return 'Établissement trouvé';
      case 'connecting':
        return 'Connexion en cours...';
      case 'success':
        return 'Connexion réussie !';
      default:
        return 'Connecter le compte Pronote';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={currentStep === 'connecting' ? () => {} : onClose}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 p-0 sm:max-w-md">
        <DialogHeader className="flex-shrink-0 border-b border-primary/10 px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-3 text-primary">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <School className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-lg font-bold">{getTitle()}</span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm text-primary/70 font-medium ml-[52px]">
            Intégration Pronote pour {child.firstName}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-auto">
          <div className="px-4 py-4 sm:px-6">
            {renderContent()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectPronote;
