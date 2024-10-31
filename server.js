const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const app = express();

// Fonction utilitaire pour formater les numéros de téléphone
function formatPhoneNumber(number) {
    if (!number) return null;
    let formatted = number.replace(/[^\d+]/g, '');
    if (!formatted.startsWith('+')) {
        formatted = '+' + formatted;
    }
    return formatted;
}

// Fonction de diagnostic pour erreur 403
function diagnose403Error(req) {
    console.log('\n=== DIAGNOSTIC ERREUR 403 ===');
    const diagnostics = {
        auth: false,
        headers: false,
        twilioSignature: false,
        numberFormat: false,
        problems: []
    };

    // Vérification des en-têtes
    console.log('1. Vérification des en-têtes:');
    if (!req.headers['x-twilio-signature']) {
        diagnostics.problems.push('Signature Twilio manquante');
        console.log('❌ Signature Twilio manquante');
    }

    // Vérification des numéros
    console.log('\n2. Vérification des numéros:');
    const fromNumber = req.body?.From;
    const toNumber = req.body?.To;

    if (!fromNumber || !toNumber) {
        diagnostics.problems.push('Numéros de téléphone manquants');
        console.log('❌ Numéros manquants');
    } else if (!fromNumber.startsWith('+') || !toNumber.startsWith('+')) {
        diagnostics.problems.push('Format des numéros incorrect');
        console.log('❌ Format des numéros incorrect');
    }

    console.log('\n=== DÉTAILS DE LA REQUÊTE ===');
    console.log('URL:', req.url);
    console.log('Méthode:', req.method);
    console.log('En-têtes:', req.headers);
    console.log('Corps:', req.body);

    return diagnostics;
}

// Configuration CORS améliorée
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Twilio-Signature');
    res.header('Access-Control-Allow-Credentials', true);
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Middleware pour le diagnostic des erreurs 403
app.use((req, res, next) => {
    const originalStatus = res.status;
    res.status = function(code) {
        if (code === 403) {
            const diagnostics = diagnose403Error(req);
            console.log('\nRaisons possibles du 403:');
            diagnostics.problems.forEach(problem => console.log(`- ${problem}`));
        }
        return originalStatus.apply(this, arguments);
    };
    next();
});

// Route racine
app.get('/', (req, res) => {
    console.log('GET / appelé');
    res.send('Twilio Voice Server - Status: Running');
});

// Route GET pour validation Twilio
app.get('/voice', (req, res) => {
    console.log('=== GET /voice appelé ===');
    console.log('Headers:', req.headers);
    
    const twiml = new VoiceResponse();
    twiml.say({
        language: 'fr-FR',
        voice: 'woman'
    }, 'Service vocal Twilio actif');
    
    console.log('TwiML généré (GET):', twiml.toString());
    res.type('text/xml');
    res.send(twiml.toString());
});

// Route principale pour les appels
app.post('/voice', (req, res) => {
    console.log('=== POST /voice appelé ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    // Vérification préliminaire pour diagnostic 403
    if (!req.headers['x-twilio-signature']) {
        console.warn('⚠️ Requête sans signature Twilio');
        diagnose403Error(req);
    }
    
    const twiml = new VoiceResponse();
    
    try {
        const toNumber = formatPhoneNumber(req.body.To);
        const fromNumber = '+32460205680';
        
        console.log('Tentative d\'appel:');
        console.log('- De:', fromNumber);
        console.log('- Vers:', toNumber);
        
        if (!toNumber) {
            throw new Error('Numéro de destination manquant ou invalide');
        }
        
        const dial = twiml.dial({
            callerId: fromNumber,
            timeout: 30,
            answerOnBridge: true,
            record: 'record-from-answer'
        });
        
        dial.number({
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallback: `${req.protocol}://${req.get('host')}/status`,
            statusCallbackMethod: 'POST'
        }, toNumber);
        
        const generatedTwiML = twiml.toString();
        console.log('TwiML généré (POST):', generatedTwiML);
        
        res.type('text/xml');
        res.send(generatedTwiML);
        
    } catch (error) {
        console.error('Erreur lors du traitement de l\'appel:', error);
        diagnose403Error(req);
        
        const errorResponse = new VoiceResponse();
        errorResponse.say({
            language: 'fr-FR',
            voice: 'woman'
        }, 'Une erreur est survenue lors de l\'appel. Veuillez réessayer.');
        
        res.type('text/xml');
        res.send(errorResponse.toString());
    }
});

// Route pour les callbacks de statut
app.post('/status', (req, res) => {
    console.log('=== Mise à jour du statut d\'appel ===');
    console.log('CallSid:', req.body.CallSid);
    console.log('CallStatus:', req.body.CallStatus);
    console.log('From:', req.body.From);
    console.log('To:', req.body.To);
    console.log('Duration:', req.body.CallDuration);
    
    res.sendStatus(200);
});

// Gestion des erreurs globale
app.use((err, req, res, next) => {
    console.error('Erreur serveur:', err);
    diagnose403Error(req);
    res.status(500).json({
        error: 'Erreur serveur',
        message: err.message
    });
});

// Démarrage du serveur
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('\n=== Serveur Twilio Voice démarré ===');
    console.log(`Port: ${port}`);
    console.log(`URL externe: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`}`);
    console.log('\nRoutes disponibles:');
    console.log('- GET  / -> Vérification du statut');
    console.log('- GET  /voice -> Validation Twilio');
    console.log('- POST /voice -> Gestion des appels');
    console.log('- POST /status -> Callbacks de statut');
    console.log('\nNuméro Twilio configuré:', '+32460205680');
});