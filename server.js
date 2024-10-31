const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();

// Configuration sécurisée avec variables d'environnement
const TWILIO_CONFIG = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKeySid: process.env.TWILIO_API_KEY_SID,
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
    twimlAppSid: process.env.TWILIO_APP_SID,
    twilioNumber: process.env.TWILIO_PHONE_NUMBER
};

// Vérification de la configuration
console.log('Vérification de la configuration Twilio...');
Object.entries(TWILIO_CONFIG).forEach(([key, value]) => {
    if (!value) {
        console.error(`❌ ${key} manquant dans les variables d'environnement`);
        process.exit(1);
    }
});
console.log('✓ Configuration validée');

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

    console.log('1. Vérification des en-têtes:');
    if (!req.headers['x-twilio-signature']) {
        diagnostics.problems.push('Signature Twilio manquante');
        console.log('❌ Signature Twilio manquante');
    }

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

// Middleware pour CORS et parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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

// Route de test
app.get('/', (req, res) => {
    console.log('GET / appelé');
    res.send('Twilio Voice Server - Status: Running');
});

// Route pour générer le token
app.post('/token', async (req, res) => {
    console.log('=== Génération de token demandée ===');
    try {
        const grant = {
            voice: {
                incoming: { allow: true },
                outgoing: {
                    application_sid: TWILIO_CONFIG.twimlAppSid,
                    allow: true
                }
            },
            identity: `user_${Date.now()}`
        };

        const token = jwt.sign(
            {
                grants: grant,
                sub: TWILIO_CONFIG.accountSid,
                iss: TWILIO_CONFIG.apiKeySid,
                exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
                jti: `${TWILIO_CONFIG.apiKeySid}-${Date.now()}`
            },
            TWILIO_CONFIG.apiKeySecret,
            { algorithm: 'HS256' }
        );

        console.log('✓ Token généré');
        res.json({ token });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: 'Erreur de génération du token' });
    }
});

// Route pour les appels
app.post('/voice', (req, res) => {
    console.log('=== Nouvel appel ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    const twiml = new VoiceResponse();
    
    try {
        const toNumber = formatPhoneNumber(req.body.To);
        const fromNumber = TWILIO_CONFIG.twilioNumber;
        
        console.log('Appel de', fromNumber, 'vers', toNumber);
        
        if (!toNumber) {
            throw new Error('Numéro invalide');
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
        console.log('TwiML généré:', generatedTwiML);
        
        res.type('text/xml');
        res.send(generatedTwiML);
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        diagnose403Error(req);
        
        const errorResponse = new VoiceResponse();
        errorResponse.say({
            language: 'fr-FR',
            voice: 'woman'
        }, 'Une erreur est survenue');
        
        res.type('text/xml');
        res.send(errorResponse.toString());
    }
});

// Route pour les statuts
app.post('/status', (req, res) => {
    console.log('=== Mise à jour statut ===');
    console.log('CallSid:', req.body.CallSid);
    console.log('Status:', req.body.CallStatus);
    console.log('De:', req.body.From);
    console.log('Vers:', req.body.To);
    console.log('Duration:', req.body.CallDuration);
    
    res.sendStatus(200);
});

// Démarrage du serveur
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('\n=== Serveur Twilio Voice démarré ===');
    console.log(`Port: ${port}`);
    console.log(`URL externe: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`}`);
    console.log('\nConfiguration:');
    console.log('- Account SID:', TWILIO_CONFIG.accountSid.slice(0, 6) + '...');
    console.log('- API Key SID:', TWILIO_CONFIG.apiKeySid.slice(0, 6) + '...');
    console.log('- Numéro Twilio:', TWILIO_CONFIG.twilioNumber);
});