export const ERRORS = {
  AUTH_EMAIL_NOT_SENT: "Nu s-a putut trimite emailul.",
  AUTH_USER_NOT_CREATED: "Nu s-a putut crea utilizatorul.",
  AUTH_SOMETHING_WENT_WRONG: "A apărut o eroare la autentificare.",
  STRIPE_MISSING_SIGNATURE: "Nu s-a putut verifica semnătura webhook.",
  STRIPE_CUSTOMER_NOT_CREATED: "Nu s-a putut crea clientul Stripe.",
  STRIPE_SOMETHING_WENT_WRONG: "A apărut o eroare la procesarea Stripe.",
  ENVS_NOT_INITIALIZED: "Variabilele de mediu nu sunt inițializate.",
  SOMETHING_WENT_WRONG: "A apărut o eroare.",
} as const;
