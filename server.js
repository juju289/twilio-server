const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();

// Configuration avec logs détaillés
const TWILIO_CONFIG = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKeySid: process.env.TWILIO_API_KEY_SID,
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
    twimlAppSid: process.env.TWILIO_APP_SID,
    twilioNumber: process.env.TWILIO_PHONE_NUMBER
};

// Vérification détaillée de la configuration
console.log('\n=== VÉRIFICATION DE LA CONFIGURATION TWILIO ===');
Object.entries(TWILIO_CONFIG).forEach(([key, value]) => {
    if (!value) {
        console.error(`❌ ${key} manquant dans les variables d'environnement`);
        process.exit(1);
    }
    console.log(`✓ ${key}: ${key.includes('Secret') ? '****' : value.slice(0, 6) + '...'}`);
});
console.log('✓ Configuration validée\n');

// Middleware avec logs
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
    console.log('\n=== NOUVELLE REQUÊTE ===');
    console.log('URL:', req.url);
    console.log('Méthode:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Twilio-Signature');
    res.header('Access-Control-Allow-Credentials', true);
    
    if (req.method === 'OPTIONS') {
        console.log('OPTIONS request - Réponse 200');
        return res.sendStatus(200);
    }
    next();
});

function formatPhoneNumber(number) {
    console.log('=== Formatage du numéro ===');
    console.log('Numéro d\'entrée:', number);
    
    if (!number) {
        console.log('❌ Numéro manquant');
        return null;
    }
    
    let formatted = number.replace(/[^\d+]/g, '');
    if (!formatted.startsWith('+')) {
        formatted = '+' + formatted;
    }
    
    console.log('Numéro formaté:', formatted);
    return formatted;
}

app.get('/', (req, res) => {
    console.log('\n=== GET / appelé ===');
    res.send('Twilio Voice Server - Status: Running');
});

app.post('/token', async (req, res) => {
    console.log('\n=== GÉNÉRATION DE TOKEN DEMANDÉE ===');
    console.log('Body de la requête:', req.body);
    
    try {
        // Log détaillé de la configuration utilisée
        console.log('Configuration utilisée:');
        console.log('- TwiML App SID:', TWILIO_CONFIG.twimlAppSid);
        console.log('- Account SID:', TWILIO_CONFIG.accountSid);
        console.log('- API Key SID:', TWILIO_CONFIG.apiKeySid);
        console.log('- API Key Secret présent:', !!TWILIO_CONFIG.apiKeySecret);
        
        const grant = {
            voice: {
                incoming: { allow: true },
                outgoing: {
                    application_sid: TWILIO_CONFIG.twimlAppSid,
                    allow: true,
                    params: {
                        // Ajout des paramètres explicites pour le débogage
                        CallerId: TWILIO_CONFIG.twilioNumber
                    }
                }
            },
            identity: `user_${Date.now()}`
        };
        
        console.log('Grant généré:', JSON.stringify(grant, null, 2));

        const tokenPayload = {
            grants: grant,
            sub: TWILIO_CONFIG.accountSid,
            iss: TWILIO_CONFIG.apiKeySid,
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
            jti: `${TWILIO_CONFIG.apiKeySid}-${Date.now()}`
        };
        
        console.log('Payload du token:', JSON.stringify(tokenPayload, null, 2));

        const token = jwt.sign(
            tokenPayload,
            TWILIO_CONFIG.apiKeySecret,
            { algorithm: 'HS256' }
        );

        console.log('✓ Token généré avec succès');
        console.log('Longueur du token:', token.length);
        console.log('Début du token:', token.substring(0, 50) + '...');
        
        res.json({ token });
    } catch (error) {
        console.error('\n❌ ERREUR DE GÉNÉRATION DU TOKEN:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('Code:', error.code);
        res.status(500).json({ 
            error: 'Erreur de génération du token',
            details: error.message,
            code: error.code
        });
    }
});

app.get('/voice', (req, res) => {
    console.log('\n=== GET VOICE APPELÉ ===');
    console.log('Headers:', req.headers);
    console.log('Query:', req.query);
    
    const twiml = new VoiceResponse();
    
    try {
        twiml.say({
            language: 'fr-FR',
            voice: 'woman'
        }, 'Bienvenue sur le service vocal');
        
        const generatedTwiML = twiml.toString();
        console.log('TwiML généré:', generatedTwiML);
        
        res.type('text/xml');
        res.send(generatedTwiML);
    } catch (error) {
        console.error('❌ Erreur GET /voice:', error);
        res.status(500).send('Erreur serveur');
    }
});

app.post('/voice', (req, res) => {
    console.log('\n=== POST VOICE APPELÉ ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    const twiml = new VoiceResponse();
    
    try {
        const toNumber = formatPhoneNumber(req.body.To);
        const fromNumber = TWILIO_CONFIG.twilioNumber;
        
        console.log('Configuration de l\'appel:');
        console.log('- De:', fromNumber);
        console.log('- Vers:', toNumber);
        
        if (!toNumber) {
            throw new Error('Numéro invalide');
        }
        
        const dialParams = {
            callerId: fromNumber,
            timeout: 30,
            answerOnBridge: true,
            record: 'record-from-answer'
        };
        
        console.log('Paramètres Dial:', dialParams);
        const dial = twiml.dial(dialParams);
        
        const numberParams = {
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallback: `${req.protocol}://${req.get('host')}/status`,
            statusCallbackMethod: 'POST'
        };
        
        console.log('Paramètres Number:', numberParams);
        dial.number(numberParams, toNumber);
        
        const generatedTwiML = twiml.toString();
        console.log('TwiML généré:', generatedTwiML);
        
        res.type('text/xml');
        res.send(generatedTwiML);
        
    } catch (error) {
        console.error('\n❌ ERREUR POST /voice:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
        const errorResponse = new VoiceResponse();
        errorResponse.say({
            language: 'fr-FR',
            voice: 'woman'
        }, 'Une erreur est survenue');
        
        console.log('TwiML d\'erreur généré:', errorResponse.toString());
        
        res.type('text/xml');
        res.send(errorResponse.toString());
    }
});

app.post('/status', (req, res) => {
    console.log('\n=== MISE À JOUR STATUT ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body complet:', JSON.stringify(req.body, null, 2));
    console.log('Détails:');
    console.log('- CallSid:', req.body.CallSid);
    console.log('- Status:', req.body.CallStatus);
    console.log('- De:', req.body.From);
    console.log('- Vers:', req.body.To);
    console.log('- Duration:', req.body.CallDuration);
    console.log('- Direction:', req.body.Direction);
    console.log('- API Version:', req.body.ApiVersion);
    
    res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('\n=== SERVEUR TWILIO VOICE DÉMARRÉ ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Port:', port);
    console.log('URL externe:', process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`);
    console.log('\nConfiguration:');
    Object.entries(TWILIO_CONFIG).forEach(([key, value]) => {
        if (key.includes('Secret')) {
            console.log(`- ${key}: [MASQUÉ]`);
        } else {
            console.log(`- ${key}: ${value ? (value.slice(0, 6) + '...') : 'NON DÉFINI'}`);
        }
    });
    console.log('\nServer prêt à recevoir des requêtes');
});