/**
 * Card — parité design system : sous-composants alignés sur packages/ui.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

describe('Card', () => {
  it('renders header, title, description and content', () => {
    const { getByText } = render(
      <Card>
        <CardHeader>
          <CardTitle>Mes révisions</CardTitle>
          <CardDescription>3 decks à revoir</CardDescription>
        </CardHeader>
        <CardContent>
          <CardTitle>Contenu</CardTitle>
        </CardContent>
      </Card>
    );
    expect(getByText('Mes révisions')).toBeTruthy();
    expect(getByText('3 decks à revoir')).toBeTruthy();
    expect(getByText('Contenu')).toBeTruthy();
  });
});
