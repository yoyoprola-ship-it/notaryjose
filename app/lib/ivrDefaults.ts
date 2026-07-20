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
    en: 'Press 1 to book an appointment. Press 2 to leave a voice consultation.',
    es: 'Marque uno para agendar una cita. Marque dos para dejar una consulta de voz.',
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
  retry: {
    en: 'I did not understand your selection.',
    es: 'No entendí su selección.',
  },
};
