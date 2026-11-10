import sgMail from "@sendgrid/mail"

// Every email of the app goes through send(). Each message has a text part and an HTML part built from the same pieces

const TEXTS = {
  it: {
    locale: "it-IT",
    labels: { date: "Data", time: "Ora", guests: "Persone", name: "Nome", notes: "Note" },
    linkFallback: "Se il pulsante non funziona, copia questo link nel browser:",
    signature: "A presto,\nComanda",
    verify: {
      subject: "Conferma la tua prenotazione da Comanda",
      heading: "Conferma la tua prenotazione",
      paragraphs: (name) => [
        `Ciao ${name}, grazie per aver scelto Comanda.`,
        "Apri il link qui sotto entro 30 minuti per confermare la prenotazione: fino ad allora il tavolo non è riservato.",
      ],
      action: "Conferma la prenotazione",
      footer: "Se non hai fatto tu questa richiesta, ignora questa email: scadrà da sola.",
    },
    confirmed: {
      subject: "Prenotazione confermata da Comanda",
      heading: "La tua prenotazione è confermata",
      paragraphs: (name) => [`Ciao ${name}, ti aspettiamo!`, "Se cambi programma, puoi annullare la prenotazione da qui:"],
      action: "Annulla la prenotazione",
      footer: "Conserva questa email: il link serve per annullare.",
    },
    pending: {
      subject: "Abbiamo ricevuto la tua richiesta di prenotazione",
      heading: "Richiesta ricevuta",
      paragraphs: (name) => [
        `Ciao ${name}, grazie per la richiesta.`,
        "Per i gruppi numerosi controlliamo i tavoli liberi prima di confermare: riceverai un'altra email con la nostra risposta.",
        "Se cambi programma, puoi ritirare la richiesta da qui:",
      ],
      action: "Ritira la richiesta",
      footer: "Conserva questa email: il link serve per ritirare la richiesta, e anche per annullarla dopo la conferma.",
    },
    rejected: {
      subject: "La tua richiesta di prenotazione da Comanda",
      heading: "Non possiamo confermare la prenotazione",
      paragraphs: (name) => [
        `Ciao ${name}, ci dispiace: non riusciamo ad accogliere il tuo gruppo in questa data e a questo orario.`,
        "Puoi scegliere un altro giorno o un altro orario sul nostro sito.",
      ],
      action: "Prenota di nuovo",
    },
    cancelled: {
      subject: "La tua prenotazione da Comanda è stata annullata",
      heading: "Prenotazione annullata",
      paragraphs: (name) => [
        `Ciao ${name}, ci dispiace: abbiamo dovuto annullare la tua prenotazione. Ci scusiamo per l'inconveniente.`,
        "Puoi scegliere un altro giorno o un altro orario sul nostro sito.",
      ],
      action: "Prenota di nuovo",
    },
  },
  en: {
    locale: "en-GB",
    labels: { date: "Date", time: "Time", guests: "Guests", name: "Name", notes: "Notes" },
    linkFallback: "If the button doesn't work, copy this link into your browser:",
    signature: "See you soon,\nComanda",
    verify: {
      subject: "Confirm your booking at Comanda",
      heading: "Confirm your booking",
      paragraphs: (name) => [
        `Hi ${name}, thank you for choosing Comanda.`,
        "Open the link below within 30 minutes to confirm your booking: until then the table is not reserved.",
      ],
      action: "Confirm my booking",
      footer: "If you didn't make this request, just ignore this email: it will expire on its own.",
    },
    confirmed: {
      subject: "Your booking at Comanda is confirmed",
      heading: "Your booking is confirmed",
      paragraphs: (name) => [`Hi ${name}, we look forward to seeing you!`, "If your plans change, you can cancel your booking here:"],
      action: "Cancel my booking",
      footer: "Keep this email: you need the link to cancel.",
    },
    pending: {
      subject: "We have received your booking request",
      heading: "Request received",
      paragraphs: (name) => [
        `Hi ${name}, thank you for your request.`,
        "For large groups we check our free tables before confirming: you will get another email with our answer.",
        "If your plans change, you can withdraw your request here:",
      ],
      action: "Withdraw my request",
      footer: "Keep this email: you need the link to withdraw your request, or to cancel it once confirmed.",
    },
    rejected: {
      subject: "Your booking request at Comanda",
      heading: "We can't confirm your booking",
      paragraphs: (name) => [
        `Hi ${name}, we're sorry: we can't seat your group on this date and at this time.`,
        "You can choose another day or time on our website.",
      ],
      action: "Book again",
    },
    cancelled: {
      subject: "Your booking at Comanda has been cancelled",
      heading: "Booking cancelled",
      paragraphs: (name) => [
        `Hi ${name}, we're sorry: we had to cancel your booking. We apologise for the inconvenience.`,
        "You can choose another day or time on our website.",
      ],
      action: "Book again",
    },
  },
}

const emailError = (message) => {
  const err = new Error(message)
  err.status = 502 // our request was fine, the email service failed
  err.code = "EMAIL_SEND_FAILED"
  return err
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])

const frontendUrl = () => process.env.FRONTEND_URL?.replace(/\/+$/, "") // email links always open the frontend, never the API

// "2026-11-14" --> "sabato 14 novembre 2026". UTC on both sides: the string is a calendar day, not a moment
const formatDate = (date, locale) =>
  new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`))

const bookingDetails = (reservation, texts) => {
  const { labels } = texts
  const details = [
    [labels.date, formatDate(reservation.date, texts.locale)],
    [labels.time, reservation.time],
    [labels.guests, reservation.partySize],
    [labels.name, `${reservation.name} ${reservation.surname}`],
  ]
  if (reservation.notes) details.push([labels.notes, reservation.notes])
  return details
}

const toText = ({ heading, paragraphs, details, action, footer, signature }) =>
  [
    heading,
    ...paragraphs,
    details.map(([label, value]) => `${label}: ${value}`).join("\n"),
    action && `${action.label}: ${action.url}`,
    footer,
    signature,
  ]
    .filter(Boolean)
    .join("\n\n")

// Every string is escaped, ours too: the guest's name and notes can't add HTML to the email
const toHtml = ({ lang, heading, paragraphs, details, action, footer, signature, linkFallback }) => `<!doctype html>
<html lang="${lang}">
<body style="margin:0;padding:24px 16px;background:#f5f0e7;color:#241c18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 24px">
    <p style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#8f1f26">Comanda</p>
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:normal">${escapeHtml(heading)}</h1>
    ${paragraphs.map((text) => `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`).join("\n    ")}
    <table role="presentation" style="margin:0 0 24px;border-collapse:collapse">
      ${details.map(([label, value]) => `<tr><td style="padding:4px 16px 4px 0;color:#6b5f57;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`).join("\n      ")}
    </table>
    ${action ? `<p style="margin:0 0 16px"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#8f1f26;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px">${escapeHtml(action.label)}</a></p>
    <p style="margin:0 0 24px;font-size:13px;color:#6b5f57">${escapeHtml(linkFallback)}<br><a href="${escapeHtml(action.url)}" style="color:#8f1f26;word-break:break-all">${escapeHtml(action.url)}</a></p>` : ""}
    ${footer ? `<p style="margin:0 0 16px;font-size:14px;color:#6b5f57">${escapeHtml(footer)}</p>` : ""}
    <p style="margin:0">${escapeHtml(signature).replace("\n", "<br>")}</p>
  </div>
</body>
</html>`

const send = async ({ to, subject, text, html }) => {
  if (to.endsWith(".test")) { // reserved domain of the demo and Bruno addresses: nobody would receive it, and bounces hurt the sender's reputation
    console.log(`Email skipped (.test address): ${subject}`)
    return
  }

  const { SENDGRID_API_KEY, SENDGRID_SENDER } = process.env
  if (!SENDGRID_API_KEY || !SENDGRID_SENDER || !frontendUrl()) {
    console.error("Email not sent: SENDGRID_API_KEY, SENDGRID_SENDER or FRONTEND_URL is missing")
    throw emailError("Email service is not configured")
  }

  sgMail.setApiKey(SENDGRID_API_KEY)

  try {
    await sgMail.send({
      to,
      from: { email: SENDGRID_SENDER, name: "Comanda" },
      subject,
      text,
      html,
      trackingSettings: { clickTracking: { enable: false, enableText: false } }, // links stay as we wrote them: the tokens never pass through SendGrid's redirect
    })
    console.log(`Email sent: ${subject}`)
  } catch (sendError) { // only the status and SendGrid's messages: the error also holds our request, links included
    const reasons = sendError.response?.body?.errors?.map((item) => item.message).join("; ")
    console.error(`Email failed (${sendError.code ?? "no status"}): ${reasons || sendError.message}`)
    throw emailError("The email could not be sent")
  }
}

// kind: a key of TEXTS.it (verify, confirmed, pending, rejected, cancelled). path: where the button leads, if any
const sendReservationEmail = (reservation, kind, path) => {
  const texts = TEXTS[reservation.lang] ?? TEXTS.it
  const copy = texts[kind]
  const content = {
    lang: reservation.lang ?? "it",
    heading: copy.heading,
    paragraphs: copy.paragraphs(reservation.name),
    details: bookingDetails(reservation, texts),
    action: copy.action && { label: copy.action, url: `${frontendUrl()}${path}` },
    footer: copy.footer,
    signature: texts.signature,
    linkFallback: texts.linkFallback,
  }

  return send({ to: reservation.email, subject: copy.subject, text: toText(content), html: toHtml(content) })
}

// The reservation must carry its tokens: both are in memory after create(), a booking read back later needs .select("+cancelToken")
export const sendVerifyEmail = (reservation) => sendReservationEmail(reservation, "verify", `/book/confirm/${reservation.verifyToken}`)

export const sendConfirmationEmail = (reservation) => sendReservationEmail(reservation, "confirmed", `/book/cancel/${reservation.cancelToken}`)

export const sendBigGroupNotice = (reservation) => sendReservationEmail(reservation, "pending", `/book/cancel/${reservation.cancelToken}`) // same link as the confirmation: the cancel page withdraws a pending request

export const sendBookingDeclinedEmail = (reservation) => sendReservationEmail(reservation, reservation.status, "/book") // status: rejected or cancelled
