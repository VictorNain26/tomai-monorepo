import { useUser } from "../lib/auth";
import React from 'react';
import { Navigate } from 'react-router';
import { isITomAIUser } from '@/types';

/**
 * Composant de redirection simple basé sur le rôle utilisateur
 * Plus d'hybridation - chaque rôle a sa page dédiée
 */
const HomePage: React.FC = () => {
  const user = useUser();

  // Loading state - pas de spinner, redirection rapide
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Redirections claires par rôle
  if (isITomAIUser(user)) {
    if (user.role === 'student') {
      return <Navigate to="/student" replace />;
    }

    if (user.role === 'parent') {
      return <Navigate to="/parent" replace />;
    }
  }

  // Fallback pour rôles non reconnus
  return <Navigate to="/auth/login" replace />;
};

export default HomePage;
