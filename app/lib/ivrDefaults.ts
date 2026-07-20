const SITE_DISPLAY = 'notaryjose dot lafayettelamarket dot com';

export interface IvrConfig {
  voices:        { en: string; es: string };
  intro:         { en: string; es: string };
  langPrompt:    { en: string; es: string };
  menu:          { en: string; es: string };
  bookConfirm:   { en: string; es: string };
  bookBye:       { en: string; es: string };
  consultPrompt: { en: string; es: string };
  consultNoRec:  { en: string; es: string };
  consultBye:    { en: string; es: string };
  directPrompt:  { en: string; es: string };
  directBusy:    { en: string; es: string };
  retry:         { en: string; es: string };
}

export const DEFAULT_IVR_CONFIG: IvrConfig = {
  voices:     { en: 'Polly.Matthew', es: 'Polly.Miguel' },
  intro:      {
    en: 'Thank you for calling. I am Jose Garcia, notary public in Lafayette, Louisiana.',
    es: 'Gracias por llamar. Soy Jose Garcia, notario público en Lafayette, Luisiana.',
  },
  langPrompt: {
    en: 'Press 1 for English.',
    es: 'Para español, marque dos.',
  },
  menu: {
    en: 'Press 1 to book an appointment. Press 2 to leave a voice consultation. Press 3 to speak directly with the notary.',
    es: 'Marque uno para agendar una cita. Marque dos para dejar una consulta de voz. Marque tres para hablar directamente con el notario.',
  },
  bookConfirm: {
    en: `Visit ${SITE_DISPLAY} to book your appointment online. A text message with the link has been sent to your phone.`,
    es: `Visite ${SITE_DISPLAY} para agendar su cita en línea. Se ha enviado un mensaje de texto con el enlace a su teléfono.`,
  },
  bookBye: {
    en: 'Thank you. Goodbye!',
    es: '¡Gracias! ¡Hasta luego!',
  },
  consultPrompt: {
    en: 'Please leave your message after the beep. Press pound when you are finished.',
    es: 'Por favor deje su mensaje después del tono. Presione numeral cuando haya terminado.',
  },
  consultNoRec: {
    en: 'We did not receive a message. Please try again. Goodbye.',
    es: 'No recibimos su mensaje. Por favor intente de nuevo. Hasta luego.',
  },
  consultBye: {
    en: 'Your message has been saved. We will get back to you soon. Goodbye!',
    es: 'Su mensaje ha sido guardado. Nos comunicaremos pronto con usted. ¡Hasta luego!',
  },
  directPrompt: {
    en: 'Please hold while we connect you to the notary.',
    es: 'Por favor espere mientras lo conectamos con el notario.',
  },
  directBusy: {
    en: 'The notary is not available right now. Please call back later or press 2 to leave a voice message. Goodbye.',
    es: 'El notario no está disponible en este momento. Por favor llame más tarde o marque dos para dejar un mensaje de voz. Hasta luego.',
  },
  retry: {
    en: 'I did not understand your selection.',
    es: 'No entendí su selección.',
  },
};
