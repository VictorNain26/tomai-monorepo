/**
 * PronoteStepIntro
 *
 * Welcome screen explaining why Pronote is needed before first login.
 * First step of the parent Pronote onboarding flow.
 */

import { ScrollView } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { TomAvatar } from '@/components/common';

interface PronoteStepIntroProps {
  onContinue: () => void;
}

export function PronoteStepIntro({ onContinue }: PronoteStepIntroProps) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="flex-1 items-center justify-center px-6"
    >
      <TomAvatar size="lg" />

      <Text className="mt-6 text-center text-2xl font-bold">
        Bienvenue sur TomAI !
      </Text>

      <Text variant="muted" className="mt-3 text-center text-base leading-6">
        Pour commencer, connectons votre compte Pronote.{'\n'}
        Tom pourra ainsi acceder aux devoirs, notes et emploi du temps de vos
        enfants.
      </Text>

      <Text variant="muted" className="mt-6 text-center text-xs leading-5">
        TomAI n'est pas affilie a Index Education.{'\n'}
        Vos donnees Pronote restent sur votre appareil.
      </Text>

      <Button onPress={onContinue} className="mt-8 w-full">
        <Text className="font-semibold text-primary-foreground">
          Scanner le QR code
        </Text>
      </Button>
    </ScrollView>
  );
}
