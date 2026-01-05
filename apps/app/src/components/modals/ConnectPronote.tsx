/**
 * ConnectPronote Modal - Parent-based QR Code authentication flow
 *
 * Flow:
 * 1. Search establishment to get RNE code
 * 2. Scan Pronote QR code (from Pronote app)
 * 3. Enter 4-digit PIN + Connect parent account
 * 4. Map Pronote children to TomAI children
 */

import { useState, useEffect, useMemo } from 'react';
import {
  School as SchoolIcon,
  CheckCircle,
  Loader2,
  QrCode,
  KeyRound,
  ArrowLeft,
  Users,
  Link2,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { modalStyles } from '../shared/modal-styles';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { QRScanner, type PronoteQRData } from '../pronote/QRScanner';
import {
  useConnectPronote,
  useCreateChildMappings,
  type PronoteResource,
  type ChildMappingInput,
} from '@/hooks/useParentPronote';
import { useSchoolSearch, usePronoteUrl, type School } from '@/hooks/useEstablishments';
import type { IChild } from '@/types';

interface ConnectPronoteProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  children: IChild[];
  /** Pre-selected child (when opened from ChildView) */
  preselectedChild?: IChild;
}

type ModalStep = 'search' | 'scan' | 'pin' | 'connecting' | 'mapping' | 'saving' | 'success' | 'error';

/** Mapping state: resourceIndex → childId */
type MappingState = Record<number, string>;

export default function ConnectPronote({
  isOpen,
  onClose,
  onSuccess,
  children,
  preselectedChild,
}: ConnectPronoteProps) {
  // Step management
  const [currentStep, setCurrentStep] = useState<ModalStep>('search');
  const [error, setError] = useState<string | null>(null);

  // Data collected through steps
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [qrData, setQrData] = useState<PronoteQRData | null>(null);
  const [pin, setPin] = useState('');

  // Resources from connection response
  const [pronoteResources, setPronoteResources] = useState<PronoteResource[]>([]);
  const [connectedEstablishmentName, setConnectedEstablishmentName] = useState<string>('');

  // Mapping state
  const [mappings, setMappings] = useState<MappingState>({});

  // School search state
  const [schoolQuery, setSchoolQuery] = useState('');

  // Hooks
  const { data: schools, isLoading: isSearching } = useSchoolSearch(schoolQuery);
  const { data: pronoteSchool, isLoading: isLoadingPronote } = usePronoteUrl(selectedSchool);
  const connectMutation = useConnectPronote();
  const createMappingsMutation = useCreateChildMappings();

  // Children available for mapping (not already mapped)
  const availableChildren = useMemo(() => {
    const mappedChildIds = new Set(Object.values(mappings));
    return children.filter((c) => !mappedChildIds.has(c.id));
  }, [children, mappings]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('search');
      setSelectedSchool(null);
      setQrData(null);
      setPin('');
      setError(null);
      setPronoteResources([]);
      setConnectedEstablishmentName('');
      setMappings({});
      setSchoolQuery('');
    }
  }, [isOpen]);

  // Auto-advance to scan when Pronote URL is loaded
  useEffect(() => {
    if (selectedSchool && pronoteSchool && currentStep === 'search') {
      setCurrentStep('scan');
    }
  }, [selectedSchool, pronoteSchool, currentStep]);

  // Pre-select child if only one resource matches preselectedChild
  useEffect(() => {
    if (currentStep === 'mapping' && preselectedChild && pronoteResources.length > 0) {
      // Try to auto-match based on name similarity
      const matchingResource = pronoteResources.find((r) =>
        r.name.toLowerCase().includes(preselectedChild.firstName.toLowerCase())
      );
      if (matchingResource && !mappings[matchingResource.index]) {
        setMappings((prev) => ({
          ...prev,
          [matchingResource.index]: preselectedChild.id,
        }));
      }
    }
  }, [currentStep, preselectedChild, pronoteResources, mappings]);

  // Handle school selection (from gov API results)
  const handleSelectSchool = (school: School) => {
    setSelectedSchool(school);
    // Will auto-advance to scan when pronoteSchool is loaded (useEffect above)
    setError(null);
  };

  // Handle QR scan success
  const handleQrScan = (data: PronoteQRData) => {
    setQrData(data);
    setCurrentStep('pin');
    setError(null);
  };

  // Handle QR scan error
  const handleQrError = (errorMsg: string) => {
    setError(errorMsg);
  };

  // Handle PIN submission - Connect parent account
  const handlePinSubmit = async () => {
    if (!selectedSchool || !pronoteSchool || !qrData || pin.length !== 4) {
      setError('Données manquantes. Veuillez recommencer.');
      return;
    }

    setCurrentStep('connecting');
    setError(null);

    try {
      const result = await connectMutation.mutateAsync({
        qrCodeJson: JSON.stringify(qrData),
        pin,
        establishmentName: selectedSchool.name,
      });

      if (result.resources && result.resources.length > 0) {
        setPronoteResources(result.resources);
        setConnectedEstablishmentName(result.establishmentName ?? selectedSchool.name);
        setCurrentStep('mapping');
      } else {
        setError('Aucun enfant trouvé dans votre compte Pronote.');
        setCurrentStep('error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de la connexion';
      setError(message);
      setCurrentStep('error');
    }
  };

  // Handle mapping change
  const handleMappingChange = (resourceIndex: number, childId: string) => {
    setMappings((prev) => {
      const newMappings = { ...prev };
      if (childId === '__none__') {
        delete newMappings[resourceIndex];
      } else {
        newMappings[resourceIndex] = childId;
      }
      return newMappings;
    });
  };

  // Handle mapping submission
  const handleMappingSubmit = async () => {
    const mappingInputs: ChildMappingInput[] = pronoteResources
      .filter((r) => mappings[r.index])
      .map((r) => ({
        childId: mappings[r.index],
        resourceIndex: r.index,
        pronoteChildName: r.name,
        pronoteClassName: r.className,
      }));

    if (mappingInputs.length === 0) {
      setError('Veuillez associer au moins un enfant.');
      return;
    }

    setCurrentStep('saving');
    setError(null);

    try {
      await createMappingsMutation.mutateAsync(mappingInputs);
      setCurrentStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de la sauvegarde';
      setError(message);
      setCurrentStep('error');
    }
  };

  // Go back to previous step
  const goBack = () => {
    switch (currentStep) {
      case 'scan':
        setCurrentStep('search');
        setSelectedSchool(null);
        break;
      case 'pin':
        setCurrentStep('scan');
        setQrData(null);
        break;
      case 'mapping':
        // Can't go back from mapping (already connected)
        break;
      case 'error':
        setCurrentStep('pin');
        break;
      default:
        break;
    }
    setError(null);
  };

  // Step 1: Search establishment by name
  const renderSearchStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary/20">
          <SchoolIcon className="w-7 h-7 text-primary" />
        </div>
        <p className="text-sm text-primary/70">
          Étape 1/4 : Recherchez l'établissement
        </p>
      </div>

      {/* School search input */}
      <div className="space-y-2">
        <Label htmlFor="school-search" className="text-primary font-medium">
          Nom de l'établissement
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
          <Input
            id="school-search"
            type="text"
            value={schoolQuery}
            onChange={(e) => setSchoolQuery(e.target.value)}
            placeholder="Ex: Lycée Thiers, Collège Jean Moulin..."
            className="pl-10 border-primary/20 bg-primary/5"
          />
        </div>
      </div>

      {/* Loading state */}
      {isSearching && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
          <span className="ml-2 text-sm text-primary/60">Recherche...</span>
        </div>
      )}

      {/* Selected school - loading Pronote URL */}
      {selectedSchool && isLoadingPronote && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
          <span className="ml-2 text-sm text-primary/60">Vérification Pronote...</span>
        </div>
      )}

      {/* School results */}
      {schools && schools.length > 0 && !selectedSchool && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {schools.map((school) => (
            <button
              key={school.id}
              onClick={() => handleSelectSchool(school)}
              className="w-full p-3 text-left rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <p className="font-medium text-primary text-sm">{school.name}</p>
              <p className="text-xs text-primary/60">
                {school.type} • {school.city} ({school.postalCode})
              </p>
            </button>
          ))}
        </div>
      )}

      {schools?.length === 0 && schoolQuery.length >= 3 && !isSearching && (
        <p className="text-sm text-primary/60 text-center py-2">
          Aucun établissement trouvé
        </p>
      )}

      {schoolQuery.length > 0 && schoolQuery.length < 3 && (
        <p className="text-sm text-primary/60 text-center py-2">
          Tapez au moins 3 caractères
        </p>
      )}

      <div className="flex gap-2 pt-4 border-t border-primary/10">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Annuler
        </Button>
      </div>
    </div>
  );

  // Step 2: QR Scanner
  const renderScanStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary/20">
          <QrCode className="w-7 h-7 text-primary" />
        </div>
        <p className="text-sm text-primary/70">
          Étape 2/4 : Scannez le QR code Pronote
        </p>
        {selectedSchool && (
          <p className="text-xs text-primary/50 mt-1">
            {selectedSchool.name}
          </p>
        )}
      </div>

      {/* Instructions pour générer le QR code */}
      <Alert className="bg-primary/5 border-primary/20">
        <AlertDescription className="text-xs text-primary/80">
          <strong>Depuis un ordinateur</strong>, connectez-vous à Pronote (espace Parent),
          puis cliquez sur l'icône QR code à côté de votre nom en haut de page.
          Créez un code PIN à 4 chiffres pour générer le QR code.
        </AlertDescription>
      </Alert>

      <QRScanner onScan={handleQrScan} onError={handleQrError} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 pt-4 border-t border-primary/10">
        <Button variant="outline" onClick={goBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
      </div>
    </div>
  );

  // Step 3: PIN entry
  const renderPinStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary/20">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <p className="text-sm text-primary/70">
          Étape 3/4 : Entrez le code PIN à 4 chiffres
        </p>
        <p className="text-xs text-primary/50 mt-1">
          Le code que vous avez créé pour générer le QR code
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pin-input" className="text-primary font-medium">
          Code PIN
        </Label>
        <Input
          id="pin-input"
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="• • • •"
          className="text-center text-2xl tracking-[0.5em] font-mono border-primary/20 bg-primary/5"
          autoFocus
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 pt-4 border-t border-primary/10">
        <Button variant="outline" onClick={goBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          onClick={handlePinSubmit}
          disabled={pin.length !== 4}
          className="flex-1"
        >
          Connecter
        </Button>
      </div>
    </div>
  );

  // Step: Connecting
  const renderConnectingStep = () => (
    <div className="py-8 text-center">
      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
      </div>
      <p className="text-sm text-primary/70">
        Connexion à Pronote en cours...
      </p>
    </div>
  );

  // Step 4: Mapping
  const renderMappingStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary/20">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <p className="text-sm text-primary/70">
          Étape 4/4 : Associez les comptes
        </p>
        <p className="text-xs text-primary/50 mt-1">
          {connectedEstablishmentName}
        </p>
      </div>

      <div className="space-y-3">
        {pronoteResources.map((resource) => {
          const selectedChild = children.find((c) => c.id === mappings[resource.index]);
          const childOptions = selectedChild
            ? [selectedChild, ...availableChildren]
            : availableChildren;

          return (
            <div
              key={resource.index}
              className="p-4 rounded-lg border border-primary/20 bg-primary/5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <SchoolIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{resource.name}</p>
                  {resource.className && (
                    <p className="text-xs text-muted-foreground">{resource.className}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary/50" />
                <Select
                  value={mappings[resource.index] ?? '__none__'}
                  onValueChange={(value) => handleMappingChange(resource.index, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Associer à un enfant TomAI" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Ne pas associer</span>
                    </SelectItem>
                    {childOptions.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.firstName} {child.lastName}
                        {child.schoolLevel && ` • ${child.schoolLevel}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="text-xs text-muted-foreground text-center">
        Les enfants non associés n'auront pas accès aux données Pronote.
      </div>

      <div className="flex gap-2 pt-4 border-t border-primary/10">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Plus tard
        </Button>
        <Button
          onClick={handleMappingSubmit}
          disabled={Object.keys(mappings).length === 0}
          className="flex-1"
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );

  // Step: Saving
  const renderSavingStep = () => (
    <div className="py-8 text-center">
      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
      </div>
      <p className="text-sm text-primary/70">
        Enregistrement des associations...
      </p>
    </div>
  );

  // Step: Success
  const renderSuccessStep = () => {
    const mappedCount = Object.keys(mappings).length;
    return (
      <div className="py-8 text-center">
        <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-success/20">
          <CheckCircle className="w-7 h-7 text-success" />
        </div>
        <p className="font-medium text-primary">Connexion réussie !</p>
        <p className="text-sm text-primary/60 mt-1">
          {mappedCount} enfant{mappedCount > 1 ? 's' : ''} associé{mappedCount > 1 ? 's' : ''}
        </p>
      </div>
    );
  };

  // Step: Error
  const renderErrorStep = () => (
    <div className="space-y-4">
      <div className="py-4 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-destructive/20">
          <SchoolIcon className="w-7 h-7 text-destructive" />
        </div>
        <p className="font-medium text-destructive">Échec de la connexion</p>
        {error && (
          <p className="text-sm text-destructive/80 mt-1">{error}</p>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t border-primary/10">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Fermer
        </Button>
        <Button onClick={goBack} className="flex-1">
          Réessayer
        </Button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentStep) {
      case 'search':
        return renderSearchStep();
      case 'scan':
        return renderScanStep();
      case 'pin':
        return renderPinStep();
      case 'connecting':
        return renderConnectingStep();
      case 'mapping':
        return renderMappingStep();
      case 'saving':
        return renderSavingStep();
      case 'success':
        return renderSuccessStep();
      case 'error':
        return renderErrorStep();
      default:
        return renderSearchStep();
    }
  };

  const getTitle = () => {
    switch (currentStep) {
      case 'search':
        return 'Rechercher l\'établissement';
      case 'scan':
        return 'Scanner le QR code';
      case 'pin':
        return 'Code PIN';
      case 'connecting':
        return 'Connexion...';
      case 'mapping':
        return 'Associer les enfants';
      case 'saving':
        return 'Enregistrement...';
      case 'success':
        return 'Connecté !';
      case 'error':
        return 'Erreur';
      default:
        return 'Connecter Pronote';
    }
  };

  const canClose = !['connecting', 'saving', 'success'].includes(currentStep);

  return (
    <Dialog open={isOpen} onOpenChange={canClose ? onClose : undefined}>
      <DialogContent className={cn(modalStyles.content, modalStyles.sizes.compact)}>
        <DialogHeader className={modalStyles.header}>
          <DialogTitle className="flex items-center gap-3 text-primary">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <SchoolIcon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-base font-semibold">{getTitle()}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-primary/60 ml-12">
            Connexion Pronote pour votre famille
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
}
