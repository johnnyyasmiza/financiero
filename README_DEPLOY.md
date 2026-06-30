# Checklist Deploy Financiero

## Local

- [ ] Installer les dependances : `npm install`
- [ ] Verifier les variables dans `.env.local`
- [ ] Lancer le build : `npm run build`
- [ ] Corriger toute erreur TypeScript ou ESLint bloquante

## Supabase

- [ ] Creer ou verifier les tables : `expenses`, `revenues`, `products`, `needs`, `recipes`, `recipe_ingredients`, `bills`, `invoices`, `assets`
- [ ] Executer le SQL de schema du projet si une table manque
- [ ] Verifier que les variables Supabase sont disponibles :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Vercel

- [ ] Creer un projet Vercel
- [ ] Ajouter les variables Supabase dans Vercel
- [ ] Deployer
- [ ] Tester sur mobile
- [ ] Ajouter l'app a l'ecran d'accueil

## Tests fonctionnels

- [ ] Tester le code d'acces `19831983`
- [ ] Tester le dashboard
- [ ] Tester ajouter une depense Orange
- [ ] Tester ajouter une depense Amendis
- [ ] Tester la caisse
- [ ] Tester les besoins
- [ ] Tester les recettes
- [ ] Tester le comparateur
- [ ] Tester le scan facture
- [ ] Tester les factures
