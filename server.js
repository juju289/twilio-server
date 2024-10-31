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

// Vérification détaillée de la configuration
console.log('\n=== VÉRIFICATION DE LA CONFIGURATION TWILIO ===');
console.log('Timestamp:', new Date().toISOString());
Object.entries(TWILIO_CONFIG).forEach(([key, value]) => {
    if (!value) {
        console.error(`❌ ${key} manquant dans les variables d'environnement`);
        process.exit(1);
    }
    console.log(`✓ ${key}: ${key.includes('Secret') ? '****' : value.slice(0, 6) + '...'}`);
    // Vérification supplémentaire des formats
    if (key === 'accountSid' && !value.startsWith('AC')) {
        console.warn('⚠️ Account SID devrait commencer par AC');
    }
    if (key === 'apiKeySid' && !value.startsWith('SK')) {
        console.warn('⚠️ API Key SID devrait commencer par SK');
    }
    if (key === 'twimlAppSid' && !value.startsWith('AP')) {
        console.warn('⚠️ TwiML App SID devrait commencer par AP');
    }
});
console.log('✓ Configuration validée\n');

// Middleware avec logs détaillés
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
    console.log('\n=== NOUVELLE REQUÊTE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL:', req.url);
    console.log('Méthode:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    
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

// Fonction utilitaire pour formater les numéros de téléphone avec validation
function formatPhoneNumber(number) {
    console.log('\n=== FORMATAGE DU NUMÉRO ===');
    console.log('Numéro d\'entrée:', number);
    
    if (!number) {
        console.log('❌ Numéro manquant');
        return null;
    }
    
    // Nettoyage plus strict du numéro
    let formatted = number.replace(/[^\d+]/g, '');
    if (!formatted.startsWith('+')) {
        formatted = '+' + formatted;
    }
    
    // Validation supplémentaire
    if (formatted.length < 10) {
        console.log('❌ Numéro trop court');
        return null;
    }
    
    console.log('Numéro formaté:', formatted);
    return formatted;
}

// Route de test avec diagnostics
app.get('/', (req, res) => {
    console.log('\n=== GET / appelé ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Status serveur: OK');
    res.send('Twilio Voice Server - Status: Running');
});

// Route pour générer le token avec diagnostics complets
app.post('/token', async (req, res) => {
    console.log('\n=== GÉNÉRATION DE TOKEN DEMANDÉE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Body de la requête:', JSON.stringify(req.body, null, 2));
    
    try {
        // Récupération et validation du numéro de destination
        const toNumber = req.body.to ? formatPhoneNumber(req.body.to) : null;
        console.log('Numéro de destination formaté:', toNumber);

        // Log détaillé de la configuration utilisée
        console.log('Configuration utilisée:');
        console.log('- TwiML App SID:', TWILIO_CONFIG.twimlAppSid);
        console.log('- Account SID:', TWILIO_CONFIG.accountSid);
        console.log('- API Key SID:', TWILIO_CONFIG.apiKeySid);
        console.log('- API Key Secret présent:', !!TWILIO_CONFIG.apiKeySecret);
        console.log('- Numéro Twilio:', TWILIO_CONFIG.twilioNumber);

        // Construction du grant avec paramètres complets
        const grant = {
            voice: {
                incoming: { 
                    allow: true 
                },
                outgoing: {
                    application_sid: TWILIO_CONFIG.twimlAppSid,
                    allow: true,
                    params: {
                        CallerId: TWILIO_CONFIG.twilioNumber,
                        To: toNumber,
                        From: TWILIO_CONFIG.twilioNumber,
                        // Paramètres supplémentaires pour le debugging
                        ApplicationSid: TWILIO_CONFIG.twimlAppSid,
                        AccountSid: TWILIO_CONFIG.accountSid
                    }
                }
            },
            identity: `user_${Date.now()}`
        };
        
        console.log('Grant généré:', JSON.stringify(grant, null, 2));

        // Construction du payload complet
        const tokenPayload = {
            grants: grant,
            sub: TWILIO_CONFIG.accountSid,
            iss: TWILIO_CONFIG.apiKeySid,
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
            jti: `${TWILIO_CONFIG.apiKeySid}-${Date.now()}`,
            // Métadonnées supplémentaires pour le debugging
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000)
        };
        
        console.log('Payload du token:', JSON.stringify(tokenPayload, null, 2));

        // Génération du token avec vérifications
        const token = jwt.sign(
            tokenPayload,
            TWILIO_CONFIG.apiKeySecret,
            { 
                algorithm: 'HS256',
                header: {
                    typ: 'JWT',
                    alg: 'HS256'
                }
            }
        );

        // Vérification du token généré
        const decodedToken = jwt.decode(token, { complete: true });
        console.log('Token décodé (header):', JSON.stringify(decodedToken.header, null, 2));
        console.log('Token décodé (payload):', JSON.stringify(decodedToken.payload, null, 2));

        console.log('✓ Token généré avec succès');
        console.log('Longueur du token:', token.length);
        console.log('Début du token:', token.substring(0, 50) + '...');
        
        res.json({ token });
    } catch (error) {
        console.error('\n❌ ERREUR DE GÉNÉRATION DU TOKEN:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('Code:', error.code);
        console.error('Détails complets:', error);
        
        res.status(500).json({ 
            error: 'Erreur de génération du token',
            details: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
        });
    }
});

// Routes Voice avec diagnostics complets
app.get('/voice', (req, res) => {
    console.log('\n=== GET VOICE APPELÉ ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    
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
        console.error('\n❌ ERREUR GET /voice:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).send('Erreur serveur');
    }
});

app.post('/voice', (req, res) => {
    console.log('\n=== POST VOICE APPELÉ ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    const twiml = new VoiceResponse();
    
    try {
        const toNumber = formatPhoneNumber(req.body.To);
        const fromNumber = TWILIO_CONFIG.twilioNumber;
        
        console.log('\nConfiguration de l\'appel:');
        console.log('- De:', fromNumber);
        console.log('- Vers:', toNumber);
        console.log('- TwiML App SID:', TWILIO_CONFIG.twimlAppSid);
        
        if (!toNumber) {
            throw new Error('Numéro invalide');
        }
        
        const dialParams = {
            callerId: fromNumber,
            timeout: 30,
            answerOnBridge: true,
            record: 'record-from-answer',
            // Paramètres supplémentaires pour le debugging
            action: `${req.protocol}://${req.get('host')}/voice/action`,
            method: 'POST'
        };
        
        console.log('Paramètres Dial:', JSON.stringify(dialParams, null, 2));
        const dial = twiml.dial(dialParams);
        
        const numberParams = {
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallback: `${req.protocol}://${req.get('host')}/status`,
            statusCallbackMethod: 'POST'
        };
        
        console.log('Paramètres Number:', JSON.stringify(numberParams, null, 2));
        dial.number(numberParams, toNumber);
        
        const generatedTwiML = twiml.toString();
        console.log('TwiML généré:', generatedTwiML);
        
        // Vérification de la validité du TwiML
        if (!generatedTwiML.includes('<?xml')) {
            throw new Error('TwiML invalide généré');
        }
        
        res.type('text/xml');
        res.send(generatedTwiML);
        
    } catch (error) {
        console.error('\n❌ ERREUR POST /voice:');
        console.error('Timestamp:', new Date().toISOString());
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

// Route de status avec diagnostics complets
app.post('/status', (req, res) => {
    console.log('\n=== MISE À JOUR STATUT ===');
    console.log('Timestamp:', new Date().toISOString());
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
    console.log('- Prix:', req.body.Price);
    console.log('- Erreurs:', req.body.ErrorCode, req.body.ErrorMessage);
    
    res.sendStatus(200);
});

// Route de callback d'action pour Dial
app.post('/voice/action', (req, res) => {
    console.log('\n=== CALLBACK ACTION DIAL ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    const twiml = new VoiceResponse();
    twiml.hangup();
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Démarrage du serveur avec diagnostics complets
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
    
    // Vérification finale de la configuration
    console.log('\nVérifications finales:');
    console.log('- Express configuré:', !!app);
});