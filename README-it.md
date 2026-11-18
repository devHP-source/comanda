# Comanda

> **Read in English:** [README.md](./README.md)

Un'applicazione web fullstack (MERN) per un ristorante di cucina cinese e pizzeria. Sostituisce i blocchetti cartacei con un flusso digitale condiviso tra sala e cucina, offrendo ai clienti un menu multilingue via QR code e la prenotazione online dei tavoli.

**Demo live:** https://comandafrontend.vercel.app/

---

## L'idea: com'è nata

Il nome **Comanda** viene proprio dal foglietto che il cameriere compila al tavolo e consegna in cucina.

Mentre studiavo informatica all'Istituto Tecnico Industriale Statale (ITIS), lavoravo part-time come cameriere in un ristorante cinese e pizzeria. Durante i servizi più intensi si ripetevano ogni sera gli stessi problemi:

* **I blocchetti di carta rallentavano tutti:** continui avanti e indietro verso la cucina, calligrafia frettolosa difficile da leggere per i cuochi e il rischio di dimenticare qualche tavolo.
* **Difficoltà con la lingua per i turisti:** i clienti stranieri faticavano a capire le descrizioni in italiano e avevano sempre bisogno di aiuto per ingredienti e allergeni.

Ho costruito Comanda partendo da un menu basato su quello con cui lavoravo, sotto un nome di fantasia, per risolvere esattamente questi problemi.

Una scelta precisa: **i clienti non ordinano mai dal proprio telefono**. In un ristorante con servizio al tavolo, il cameriere mantiene il contatto umano con il cliente, risponde alle domande e gestisce i tempi delle portate. L'app aiuta il personale. Non lo sostituisce.

---

## Cosa fa

### Cliente / Ospite (senza account)
Inquadrando un unico QR code, il cliente apre il menu in **italiano o inglese** (rilevato automaticamente dal browser e salvato in locale). Può navigare una categoria alla volta, cercare in tutto il menu per nome o codice del piatto, controllare allergeni e prodotti surgelati, e salvare i piatti preferiti in **"La mia lista"**: un promemoria locale con nomi in italiano e codici pensato per essere mostrato direttamente al cameriere. Può inoltre prenotare un tavolo online scegliendo solo tra gli orari realmente disponibili.

### Cameriere (mobile-first)
Sostituisce il blocchetto cartaceo. Il cameriere visualizza la griglia dei tavoli in tempo reale (libero, occupato, in preparazione, pronto), apre un tavolo per controllare le comande attive e il totale parziale, e invia nuovi ordini in cucina cercando i piatti per codice. Quando i piatti sono pronti, un avviso **"Pronto"** segnala i tavoli da servire. A fine pasto, **"Libera tavolo"** chiude tutte le comande aperte del tavolo e mostra il conto totale.

### Cucina (tablet in orizzontale)
Una bacheca a tre colonne (**Da iniziare**, **In preparazione**, **Pronto**) con schede grandi e leggibili che mostrano numero del tavolo, giro (*1ª comanda*, *2ª comanda*), quantità e note. I cuochi possono anche segnare un piatto come *"Esaurito"* per evitare che venga ordinato in sala. Poiché in cucina si lavora velocemente e spesso con le mani bagnate o infarinate, l'avanzamento di una comanda sposta subito la scheda con un **toast di annullamento di 5 secondi** ("Annulla"), evitando finestre di conferma che rallenterebbero il servizio.

### Titolare / Admin (desktop)
Una dashboard di gestione con statistiche del servizio in corso, panoramica della sala, gestione completa (CRUD) di piatti e categorie (con upload delle foto su Cloudinary), approvazione delle prenotazioni per gruppi numerosi e impostazioni del locale (orari, giorni di chiusura, capienza tavoli). Include anche la funzione **"Visualizza come"**, che permette all'admin di entrare temporaneamente nei panni di un cameriere o della cucina per 30 minuti per testare i permessi o dare una mano durante il servizio.

---

## Scelte progettuali di cui vado fiero

* **Le prenotazioni non verificate non bloccano tavoli e scadono dopo 30 minuti:** I clienti ricevono un link di conferma via email dopo aver inviato la richiesta di prenotazione. Finché non cliccano il link, la prenotazione resta in stato `awaiting_verification` e non occupa posti. Un indice TTL di MongoDB elimina automaticamente le prenotazioni non confermate dopo 30 minuti.
* **Finestre di conferma ovunque, tranne l'annulla rapido in cucina:** Ogni azione che modifica i dati (invio comanda, libera tavolo, eliminazione piatto, annullamento prenotazione) richiede una conferma esplicita tramite un elemento nativo `<dialog>` con dettagli specifici, come il totale del tavolo, per evitare tocchi accidentali. La cucina è l'unica eccezione voluta: un toast con 5 secondi per annullare ritarda l'invio al server senza intralciare i cuochi.
* **Una comanda separata per ogni invio in cucina:** Ogni volta che il cameriere invia dei piatti per un tavolo, il backend crea un nuovo ticket (`1ª comanda`, `2ª comanda`, ecc.) salvando uno snapshot di nomi e prezzi. Antipasti, primi e dolci viaggiano in modo indipendente e lo storico resta corretto anche se i prezzi del menu cambiano in futuro.
* **Capienza calcolata a tavoli, non a singoli coperti:** Una coppia occupa comunque un tavolo da quattro. Il controllo disponibilità calcola `Math.ceil(partySize / seatsPerTable)` sull'intera finestra di permanenza di 90 minuti (`[start, start + avgDuration)`), lasciando sempre 14 tavoli su 50 riservati ai clienti senza prenotazione (walk-in).

---

## Stack tecnologico

* **Frontend:** React 19, Vite, React Router v7, Axios, Sonner, `qrcode.react`. Scritto con **CSS nativo e CSS Modules** (basato sui design token in `tokens.css`) senza framework UI esterni, per avere il pieno controllo su layout responsive, barre glassmorphism, stili di stampa per il QR code e modali `<dialog>` native.
* **Backend:** Node.js (v20+), Express 5, MongoDB Atlas e Mongoose, JWT (`jsonwebtoken` + `bcrypt`), Multer e Cloudinary (gestione immagini), SendGrid (email transazionali), Cloudflare Turnstile (protezione anti-bot).
* **Hosting:** Pubblicato su **Vercel** (frontend) e **Render** (backend) con **MongoDB Atlas**. È lo stack approfondito durante il corso EPICODE, scelto per i piani gratuiti e la flessibilità del modello a documenti.

---

## Avvio in locale

### Prerequisiti
* Node.js **v20+**
* Account e chiavi per MongoDB Atlas, Cloudinary e SendGrid. I file `.env.example` contengono già le chiavi di test pubbliche di Cloudflare, pronte per l'uso in locale.

### Installazione
1. **Clona il repository e installa le dipendenze:**
   ```bash
   git clone https://github.com/devHP-source/comanda.git
   cd comanda
   npm run install:all
   ```

2. **Configura le variabili d'ambiente:**
   Copia `backend/.env.example` in `backend/.env` e `frontend/.env.example` in `frontend/.env`, poi inserisci le tue credenziali:
   * `backend/.env`: imposta `PORT=9099`, `FRONTEND_URL=http://localhost:5173`, la tua `MONGODB_URI`, `JWT_SECRET`, le chiavi Cloudinary, SendGrid e le credenziali dello staff per il seed. Lascia la chiave segreta di test di Cloudflare precompilata per lo sviluppo locale.
   * `frontend/.env`: imposta `VITE_API_URL=http://localhost:9099/api` e mantieni la site key di test di Cloudflare.

3. **Popola il database (seed):**
   ```bash
   npm run seed --prefix backend
   ```
   *(Attenzione: il seed azzera il database indicato da MONGODB_URI: ricrea categorie, piatti e impostazioni ed elimina comande e prenotazioni. Opzionale: inserisci le foto dei piatti rinominate con il codice del piatto, es. `47.jpg`, in una cartella esterna al repository e imposta `SEED_IMAGES_DIR` in `backend/.env` per caricarle automaticamente su Cloudinary. In mancanza di foto, vengono mostrati segnaposto grafici in CSS.)*

4. **Avvia entrambi i server:**
   ```bash
   npm run dev
   ```
   * **Frontend:** `http://localhost:5173` (login staff su `/staff/login`; le credenziali demo degli account staff sono condivise separatamente nella consegna EPICODE)
   * **Backend:** `http://localhost:9099` (health check su `/api/health`)

---

## Panoramica API

Tutti gli endpoint hanno prefisso `/api` e restituiscono errori strutturati nel formato `{ message, code }`.

| Area | Endpoint | Accesso |
| :--- | :--- | :--- |
| **Sistema** | `GET /health` | Pubblico |
| **Autenticazione** | `POST /auth/login`, `GET /auth/me`, `POST /auth/impersonate/:userId` | Staff / Admin |
| **Categorie** | `GET /categories`, `POST /categories`, `PUT/DELETE /categories/:id` | Pubblico (lettura), Admin (scrittura) |
| **Piatti** | `GET /dishes`, `GET /dishes/:id`, `PATCH /dishes/:id/availability`, `POST /dishes`, `PUT/DELETE /dishes/:id` | Pubblico (lettura), Staff (disponibilità), Admin (CRUD) |
| **Admin** | `GET /admin/dishes` (paginata, ricerca, filtro categoria), `GET /admin/dishes/:id`, `GET /admin/categories` | Admin |
| **Comande** | `GET /orders`, `POST /orders`, `PATCH /orders/:id/status` | Staff |
| **Tavoli** | `GET /tables`, `POST /tables/:number/close` | Cameriere, Admin |
| **Prenotazioni** | `GET /reservations/slots`, `POST /reservations`, `GET /reservations/verify/:token`, `GET/POST /reservations/cancel/:token` | Pubblico |
| **Prenotazioni (Staff)** | `GET /reservations`, `GET /reservations/:id/free-tables`, `PATCH /reservations/:id/status` | Cameriere (solo oggi), Admin (gestione) |
| **Impostazioni & Utenti** | `GET /settings/public`, `GET/PUT /settings`, `GET /users` | Pubblico (`/public`), Admin |

---

## Test con Bruno

Nella cartella `bruno/` è inclusa una collezione di test API che copre autenticazione, flussi completi dalla sala alla cucina, prenotazioni e 19 test di sicurezza contro NoSQL injection.

1. Apri la cartella `comanda/bruno/` nell'app desktop **Bruno**.
2. Crea il file `bruno/.env` con le stesse variabili `SEED_ADMIN_*`, `SEED_WAITER_*` e `SEED_KITCHEN_*` presenti in `backend/.env`.
3. Seleziona l'ambiente `local` ed esegui l'intera collezione con il Runner mentre il backend è avviato.

---

## Sicurezza

* **Autenticazione e ruoli (RBAC):** Le password dello staff sono salvate come hash con `bcrypt` (10 round). I token JWT accettano solo algoritmo `HS256` e ricaricano l'utente dal database a ogni richiesta, bloccando all'istante eventuali account disattivati. I permessi sono verificati lato server tramite middleware `authorize`.
* **Controllo su "Visualizza come":** I token di impersonificazione durano 30 minuti e decadono automaticamente se l'account admin che li ha generati non è più attivo.
* **Protezione da NoSQL injection:** È attivo `sanitizeFilter` di Mongoose, tutti i parametri provenienti da `req.body` e `req.params` vengono validati per tipo prima delle query, e gli operatori interni sono racchiusi in `mongoose.trusted()`.
* **Prevenzione XSS e header HTTP:** `helmet` protegge gli header HTTP, CORS è limitato al dominio frontend, React esegue l'escape automatico del DOM senza `dangerouslySetInnerHTML` e tutti i campi inseriti dall'utente nelle email vengono sanitizzati.
* **Protezione anti-bot e spam:** Le prenotazioni pubbliche richiedono la verifica lato server tramite **Cloudflare Turnstile** e sono limitate sia per indirizzo IP sia a un massimo di 3 prenotazioni aperte per email ogni ora.
* **Riservatezza dei token:** I token di conferma e cancellazione prenotazione sono generati con `crypto.randomBytes(32)`, oscurati nei log di Morgan e inviati disattivando il click-tracking di SendGrid.

---

## Limiti noti e sviluppi futuri

### Limiti noti
* **Prenotazioni simultanee:** Il controllo disponibilità legge e salva senza un lock transazionale sul database; due conferme nello stesso identico millisecondo potrebbero passare entrambe (assorbite nella pratica dai 14 tavoli riservati ai walk-in).
* **Consegna delle email:** Le email transazionali partono dal piano gratuito di SendGrid tramite un singolo mittente Gmail verificato senza dominio personalizzato autenticato, il che può causare occasionali ritardi o finire nello spam.
* **Cold start del server:** Il piano gratuito di Render mette in sospensione il backend dopo circa 15 minuti di inattività; la prima richiesta può richiedere dai 30 ai 60 secondi (gestiti lato frontend con un messaggio di attesa dedicato).
* **Polling vs. WebSocket:** Le schermate di sala e cucina si aggiornano ogni 5 secondi tramite polling (che si mette in pausa se la scheda non è visibile) anziché tramite WebSocket.

### Sviluppi futuri
* Login opzionale con Google OAuth per i clienti (con pagina *"Le mie prenotazioni"*) e per il titolare.
* QR code dedicati per singolo tavolo con sessione attiva e pulsante *"Chiama cameriere"*.
* Aggiornamenti in tempo reale per la cucina tramite Socket.io.
* Nuove lingue per il menu (cinese, spagnolo, francese).

---

## Crediti

* **Autore:** Gideon Paulo Alipio Del Poso ([@devHP-source](https://github.com/devHP-source)), Progetto Capstone Full-Stack Web Developer, EPICODE (2026).
* **Ispirazione:** Nato dalla mia esperienza lavorativa part-time come cameriere in un ristorante cinese e pizzeria durante gli studi presso un Istituto Tecnico Industriale Statale (ITIS). *Comanda* è un nome di fantasia.
* **Fotografie:** Immagini dei piatti tratte da [Pexels](https://www.pexels.com/).