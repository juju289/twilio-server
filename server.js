const express = require('express');
const twilio = require('twilio');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Charger les variables d'environnement
dotenv.config();

const app = express();

// Configuration Twilio
const TWILIO_CONFIG = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKeySid: process.env.TWILIO_API_KEY_SID,
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
    twimlAppSid: process.env.TWILIO_APP_SID,
    twilioNumber: process.env.TWILIO_PHONE_NUMBER
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Formatage des numéros de téléphone
function formatPhoneNumber(number) {
    if (!number) return null;
    let formatted = number.replace(/[^\d+]/g, '');
    if (!formatted.startsWith('+')) {
        formatted = '+' + formatted;
    }
    return formatted;
}

// Routes
app.get('/', (req, res) => {
    res.send('Twilio Voice Server - Status: Running');
});

app.post('/token', (req, res) => {
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

        res.json({ token });
    } catch (error) {
        console.error('Error generating token:', error);
        res.status(500).json({ error: 'Token generation failed' });
    }
});

app.post('/voice', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    
    try {
        const toNumber = formatPhoneNumber(req.body.To);
        const fromNumber = TWILIO_CONFIG.twilioNumber;
        
        if (!toNumber) {
            throw new Error('Invalid phone number');
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
        
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error handling voice call:', error);
        const errorResponse = new twilio.twiml.VoiceResponse();
        errorResponse.say({
            language: 'fr-FR',
            voice: 'woman'
        }, 'Une erreur est survenue');
        res.type('text/xml');
        res.send(errorResponse.toString());
    }
});

app.post('/status', (req, res) => {
    console.log('Call Status Update:', {
        CallSid: req.body.CallSid,
        Status: req.body.CallStatus,
        From: req.body.From,
        To: req.body.To,
        Duration: req.body.CallDuration
    });
    res.sendStatus(200);
});

// Démarrage du serveur
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Twilio Configuration:', {
        accountSid: TWILIO_CONFIG.accountSid?.slice(0, 6) + '...',
        apiKeySid: TWILIO_CONFIG.apiKeySid?.slice(0, 6) + '...',
        twilioNumber: TWILIO_CONFIG.twilioNumber
    });
});