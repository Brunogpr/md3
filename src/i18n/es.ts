import type { Dictionary } from './pt';

// Textos en español de España.
// ESTADO: borrador pendiente de revisión por un hablante nativo. El idioma sigue desactivado
// (localeSettings.es.published = false) hasta completar esa revisión.
const es: Dictionary = {
  meta: {
    title: 'MOLDEA.es — Objetos creativos y piezas personalizadas en impresión 3D',
    description:
      'Descubre objetos creativos, piezas decorativas y soluciones personalizadas que toman forma gracias a la impresión 3D. Pide tu presupuesto a Moldea.',
    notFoundTitle: 'Página no encontrada — MOLDEA.es',
    productTitle: '{product} — MOLDEA.es',
    productsTitle: 'Productos — MOLDEA.es',
    productsDescription: 'Todos los productos de MOLDEA.es: piezas decorativas, regalos y objetos personalizados en impresión 3D.',
  },
  a11y: {
    skipToContent: 'Saltar al contenido',
    mainNav: 'Navegación principal',
    footerNav: 'Navegación del pie de página',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    homeLink: 'MOLDEA.es — página de inicio',
    languageSelector: 'Idioma',
    breadcrumb: 'Ruta de navegación',
  },
  nav: {
    home: 'Inicio',
    products: 'Productos',
    customization: 'Personalización',
    about: 'Sobre nosotros',
    quoteCta: 'Solicitar presupuesto',
  },
  hero: {
    eyebrow: 'Diseño e impresión 3D',
    titleLead: 'Pequeñas ideas.',
    titleAccent: 'Grandes posibilidades.',
    subtitle:
      'Descubre objetos creativos, piezas decorativas y soluciones personalizadas que toman forma gracias a la impresión 3D.',
    primaryCta: 'Explorar productos',
    secondaryCta: 'Crear una pieza personalizada',
  },
  catalog: {
    viewAll: 'Ver todos los productos',
    pageTitle: 'Todos los productos',
    pageSubtitle: 'Explora el catálogo completo y filtra por categoría.',
    eyebrow: 'Catálogo',
    title: 'Descubre nuestras creaciones',
    subtitle: 'Objetos que combinan creatividad, diseño y nuevas posibilidades de fabricación.',
    filterLabel: 'Filtrar por categoría',
    filterAll: 'Todos',
    viewDetails: 'Ver detalles',
    requestQuote: 'Solicitar presupuesto',
    empty: 'Todavía no hay productos publicados en esta categoría.',
    emptyAll: 'Estamos preparando el catálogo. Vuelve pronto o cuéntanos tu idea.',
    emptyCta: 'Hablar con nosotros',
    customCardTitle: '¿Tienes otra idea en mente?',
    customCardText: 'Describe la pieza que imaginas y estudiaremos contigo las posibilidades.',
    customCardCta: 'Pedir una pieza personalizada',
    resultsCount: '{count} productos',
    resultsCountOne: '1 producto',
  },
  featured: {
    eyebrow: 'Producto destacado',
    title: 'Un toque especial para tus momentos.',
    text: 'Piezas decorativas que ayudan a transformar espacios y a celebrar ocasiones especiales.',
    askAbout: 'Puedes consultarnos sobre:',
    topics: ['Colores disponibles', 'Dimensiones', 'Opciones de personalización'],
    cta: 'Consultar este producto',
    detailsLink: 'Ver detalles del producto',
  },
  customization: {
    eyebrow: 'Personalización',
    title: 'Tu idea merece tomar forma.',
    text: '¿Tienes una idea o buscas una pieza personalizada? Cuéntanos qué necesitas y estudiaremos las posibilidades.',
    steps: [
      {
        title: 'Cuéntanos tu idea',
        text: 'Describe la pieza y su uso y, si los tienes, comparte referencias o bocetos.',
      },
      {
        title: 'Estudiamos los detalles del proyecto',
        text: 'Analizamos la viabilidad, los materiales posibles y las opciones de acabado.',
      },
      {
        title: 'Recibe una propuesta personalizada',
        text: 'Te enviamos una propuesta adaptada a tu solicitud, sin compromiso.',
      },
    ],
    cta: 'Pedir presupuesto personalizado',
    note: 'Cada solicitud se estudia de forma individual: la viabilidad depende del tamaño, la geometría y la finalidad de la pieza.',
  },
  benefits: {
    eyebrow: 'Por qué Moldea',
    title: '¿Por qué elegir Moldea?',
    items: [
      {
        title: 'Creatividad aplicada al diseño',
        text: 'Cada pieza parte de una idea y se piensa para ser bonita y útil.',
      },
      {
        title: 'Posibilidades de personalización',
        text: 'Colores, formas y detalles pueden ajustarse a cada encargo, siempre que el proyecto lo permita.',
      },
      {
        title: 'Atención al detalle',
        text: 'Cuidamos el acabado y la presentación de cada objeto.',
      },
      {
        title: 'Proyectos a tu medida',
        text: 'Escuchamos lo que necesitas y adaptamos la propuesta a tu objetivo.',
      },
    ],
  },
  about: {
    eyebrow: 'Sobre nosotros',
    title: 'Creamos ideas en 3D.',
    paragraphs: [
      'Moldea nace de las ganas de convertir ideas en objetos reales. Combinamos diseño e impresión 3D para crear piezas decorativas, regalos y soluciones personalizadas.',
      'Creemos que los objetos del día a día pueden tener personalidad. Por eso cuidamos cada proyecto, desde la primera conversación hasta la pieza final.',
    ],
  },
  quote: {
    eyebrow: 'Presupuesto',
    title: '¿Damos forma a tu idea?',
    text: 'Rellena el formulario con el mayor detalle posible. Preparamos el mensaje en WhatsApp: solo tienes que revisarlo y enviarlo.',
    contactTitle: 'Contacto',
    contactPending: 'Pronto publicaremos nuestros datos de contacto directo.',
    emailLabel: 'Correo electrónico',
    phoneLabel: 'Teléfono',
    whatsappLabel: 'WhatsApp',
    requiredHint: 'Los campos marcados con * son obligatorios.',
    fields: {
      name: 'Nombre',
      email: 'Correo electrónico',
      phone: 'Teléfono',
      phoneHint: 'Opcional, salvo que prefieras que te llamemos.',
      product: 'Producto de interés',
      productPlaceholder: 'Selecciona una opción',
      productNone: 'Ninguno en concreto / pieza personalizada',
      requestType: 'Tipo de solicitud',
      description: 'Descripción de la solicitud',
      descriptionHint: 'P. ej.: cantidad, colores, medidas aproximadas, fecha deseada.',
      contactPreference: '¿Cómo prefieres que te contactemos?',
      consent:
        'Acepto que Moldea utilice estos datos únicamente para responder a esta solicitud.',
      privacyLink: 'Política de privacidad',
      optional: 'opcional',
      honeypot: 'No rellenes este campo',
    },
    requestTypes: {
      catalogo: 'Presupuesto de un producto del catálogo',
      personalizado: 'Pieza personalizada',
      informacoes: 'Información sobre colores, medidas o personalización',
      outro: 'Otro asunto',
    },
    contactPreferences: {
      email: 'Correo electrónico',
      telefone: 'Teléfono',
    },
    submit: 'Continuar en WhatsApp',
    submitting: 'Abriendo WhatsApp…',
    whatsappNote:
      'Al continuar, abrimos WhatsApp con tu mensaje ya redactado. La solicitud solo se envía cuando la confirmas en la aplicación. WhatsApp es un servicio de Meta, sujeto a su propia política de privacidad.',
    whatsappGeneralMessage: '¡Hola! Me gustaría hablar con Moldea sobre un presupuesto.',
    status: {
      opened:
        'Hemos abierto WhatsApp con tu mensaje. Para terminar, revísalo y pulsa enviar en la conversación: la solicitud solo llega a Moldea cuando la envías.',
      blocked:
        'El navegador no ha abierto WhatsApp automáticamente. Usa el botón de abajo para continuar y enviar el mensaje.',
      continueLink: 'Abrir conversación en WhatsApp',
      duplicate:
        'Ya hemos preparado este mensaje. Usa el botón de abajo para volver a la conversación o modifica la solicitud para crear una nueva.',
      unavailable: 'El contacto por WhatsApp no está disponible en este momento.',
      invalid: 'Revisa los campos marcados.',
    },
    message: {
      greeting: '¡Hola! Me gustaría solicitar un presupuesto a Moldea.',
      name: 'Nombre',
      email: 'Correo electrónico',
      phone: 'Teléfono',
      product: 'Producto',
      requestType: 'Tipo de solicitud',
      contactPreference: 'Preferencia de contacto',
      description: 'Descripción',
      link: 'Página',
      closing: '¿Podríais ayudarme con esta solicitud?',
    },
    errors: {
      required: 'Este campo es obligatorio.',
      nameTooShort: 'Indica tu nombre (mínimo 2 caracteres).',
      emailInvalid: 'Indica un correo válido, por ejemplo nombre@dominio.com.',
      phoneInvalid: 'Indica un teléfono válido (solo números, espacios y +).',
      phoneRequiredForPreference: 'Indica un teléfono si prefieres que te llamemos.',
      descriptionTooShort: 'Describe la solicitud con al menos {min} caracteres.',
      descriptionTooLong: 'La descripción no puede superar los {max} caracteres.',
      consentRequired: 'Necesitamos tu aceptación para poder responder a tu solicitud.',
    },
  },
  footer: {
    tagline: 'Objetos creativos, piezas decorativas y soluciones personalizadas en impresión 3D.',
    navTitle: 'Navegación',
    contactTitle: 'Contacto',
    socialTitle: 'Redes sociales',
    legalTitle: 'Información legal',
    privacy: 'Política de privacidad',
    legalNotice: 'Aviso legal',
    cookies: 'Política de cookies',
    terms: 'Condiciones de venta',
    contactViaForm: 'Utiliza el formulario de presupuesto.',
    rights: '© {year} MOLDEA.es. Todos los derechos reservados.',
  },
  product: {
    backToCatalog: 'Volver al catálogo',
    category: 'Categoría',
    infoTitle: 'Información bajo consulta',
    infoText:
      'Los colores, las medidas y las opciones de personalización se confirman en cada caso. Pídenos los detalles sin compromiso.',
    cta: 'Solicitar presupuesto',
    whatsappCta: 'Preguntar por WhatsApp',
    whatsappMessage: '¡Hola! Me gustaría pedir información sobre el producto "{product}" de Moldea: {url}',
    relatedTitle: 'Otras creaciones',
  },
  faq: {
    eyebrow: 'Dudas',
    title: 'Preguntas frecuentes',
    items: [
      {
        question: '¿Cómo hago un pedido?',
        answer:
          'Los productos con precio se pueden añadir al carrito y pagar online. En los productos con "precio bajo consulta", pide un presupuesto por el formulario o por WhatsApp.',
        storeOnly: false,
      },
      {
        question: '¿Puedo pedir una pieza personalizada?',
        answer:
          'Sí. Describe la idea en el formulario de presupuesto (tamaño aproximado, colores, uso). Estudiamos la viabilidad de cada solicitud y te enviamos una propuesta.',
        storeOnly: false,
      },
      {
        question: '¿Cómo funciona el pago?',
        answer:
          'El pago se realiza en la página segura de Stripe. Los datos de la tarjeta los gestiona Stripe y nunca pasan por esta web.',
        storeOnly: true,
      },
      {
        question: '¿Puedo elegir colores o tamaños?',
        answer:
          'Muchas piezas se pueden adaptar. Pregúntanos por el producto que te interesa y te indicamos las opciones posibles.',
        storeOnly: false,
      },
    ],
  },
  store: {
    priceOnRequest: 'Precio bajo consulta',
    addToCart: 'Añadir al carrito',
    added: '{product} se ha añadido al carrito.',
    soldOut: 'Agotado',
    lowStock: 'Últimas {count} unidades',
    vatIncluded: 'IVA incluido',
    askPrice: 'Pedir presupuesto',
  },
  cart: {
    title: 'Carrito',
    open: 'Abrir carrito',
    itemsCount: '{count} artículos',
    itemsCountOne: '1 artículo',
    close: 'Cerrar carrito',
    empty: 'Tu carrito está vacío.',
    continueShopping: 'Ver productos',
    remove: 'Eliminar',
    increase: 'Aumentar cantidad',
    decrease: 'Reducir cantidad',
    quantity: 'Cantidad',
    subtotal: 'Subtotal',
    shipping: 'Envío',
    freeShipping: 'Gratis',
    freeShippingFrom: 'Envío gratis a partir de {amount}.',
    total: 'Total',
    checkout: 'Finalizar compra',
    checkingOut: 'Preparando el pago…',
    secure: 'Pago seguro en la página de Stripe: los datos de la tarjeta no pasan por esta web.',
    termsPrefix: 'Al finalizar, aceptas las',
    termsLink: 'condiciones de venta',
    errors: {
      storeClosed: 'Las compras online no están disponibles en este momento.',
      changed: 'Algunos productos han cambiado de precio, stock o disponibilidad. Hemos actualizado el carrito: revísalo antes de continuar.',
      generic: 'No se ha podido iniciar el pago. Comprueba tu conexión e inténtalo de nuevo.',
    },
  },
  checkout: {
    successTitle: '¡Gracias por tu compra!',
    successText:
      'El pago se ha confirmado. Prepararemos tu pedido y te contactaremos a través del correo indicado en el pago.',
    pendingTitle: 'Pago en proceso',
    pendingText: 'En cuanto Stripe confirme el pago, te contactaremos por correo. No tienes que volver a pagar.',
    unknownTitle: 'No hemos encontrado este pago',
    unknownText: 'Si se te ha cobrado, contáctanos con la referencia del recibo de Stripe.',
    orderRef: 'Referencia del pedido',
    cancelTitle: 'Pago cancelado',
    cancelText: 'No se ha realizado ningún pago. Los productos siguen en tu carrito.',
    backToStore: 'Volver a la tienda',
    contactUs: 'Hablar con nosotros por WhatsApp',
  },
  banner: {
    alt: 'MOLDEA.es — Creamos ideas en 3D: boquilla de impresora 3D dibujando la letra M, con un pequeño dragón naranja.',
  },
  notFound: {
    title: 'Página no encontrada',
    text: 'La página que buscas no existe o se ha movido.',
    cta: 'Volver al inicio',
  },
};

export default es;
