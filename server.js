const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const app = express();

// Configuration CORS
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

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Route GET pour /voice (ajout important)
app.get('/voice', (req, res) => {
    console.log('GET /voice appelé');
    const twiml = new VoiceResponse();
    
    // Réponse TwiML basique pour les requêtes GET
    twiml.say({
        language: 'fr-FR',
        voice: 'woman'
    }, 'Service vocal Twilio actif');
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Route POST existante pour /voice
app.post('/voice', (req, res) => {
    console.log('=== Nouvelle requête d\'appel (POST) ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    const twiml = new VoiceResponse();
    
    try {
        const toNumber = req.body.To;
        const fromNumber = '+32460205680';
        
        console.log('Appel de', fromNumber, 'vers', toNumber);
        
        const dial = twiml.dial({
            callerId: fromNumber,
            timeout: 30,
            answerOnBridge: true
        });
        
        if (toNumber) {
            dial.number({
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                statusCallback: `${req.protocol}://${req.get('host')}/status`,
                statusCallbackMethod: 'POST'
            }, toNumber);
            
            console.log('TwiML généré pour l\'appel');
        }
        
        res.type('text/xml');
        res.send(twiml.toString());
        
    } catch (error) {
        console.error('Erreur:', error);
        const errorResponse = new VoiceResponse();
        errorResponse.say({
            language: 'fr-FR',
            voice: 'woman'
        }, 'Une erreur est survenue');
        
        res.type('text/xml');
        res.send(errorResponse.toString());
    }
});

// Route de test racine
app.get('/', (req, res) => {
    console.log('GET / appelé');
    res.send('Twilio Voice Server - Status: Running');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
    console.log('Routes disponibles:');
    console.log('- GET  /');
    console.log('- GET  /voice');
    console.log('- POST /voice');
    console.log('- POST /status');
});