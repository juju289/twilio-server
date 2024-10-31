const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const app = express();

// Configuration CORS améliorée
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    
    // Gérer les requêtes OPTIONS pour le CORS
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Fonction utilitaire pour formater les numéros de téléphone
function formatPhoneNumber(number) {
    if (!number) return null;
    // Supprimer tous les caractères non numériques sauf le +
    let formatted = number.replace(/[^\d+]/g, '');
    // Ajouter le + si nécessaire
    if (!formatted.startsWith('+')) {
        formatted = '+' + formatted;
    }
    return formatted;
}

// Route de test
app.get('/', (req, res) => {
    res.send('Server is running - Twilio Voice Service');
});

// Route principale pour les appels avec logging amélioré
app.post('/voice', (req, res) => {
    console.log('=== Nouvelle requête d\'appel ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    const twiml = new VoiceResponse();
    
    try {
        // Formatage des numéros
        const toNumber = formatPhoneNumber(req.body.To);
        const fromNumber = '+32460205680'; // Votre numéro Twilio fixe
        
        console.log('Tentative d\'appel de', fromNumber, 'vers', toNumber);
        
        const dial = twiml.dial({
            callerId: fromNumber,
            timeout: 30,
            record: 'record-from-answer',
            answerOnBridge: true
        });
        
        if (toNumber) {
            dial.number({
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                statusCallback: `${req.protocol}://${req.get('host')}/status`,
                statusCallbackMethod: 'POST'
            }, toNumber);
        } else {
            throw new Error('Numéro de destination manquant');
        }
        
        const generatedTwiML = twiml.toString();
        console.log('TwiML généré:', generatedTwiML);
        
        res.type('text/xml');
        res.send(generatedTwiML);
        
    } catch (error) {
        console.error('Erreur lors de la génération du TwiML:', error);
        const errorResponse = new VoiceResponse();
        errorResponse.say({
            language: 'fr-FR',
            voice: 'woman'
        }, 'Une erreur est survenue lors de l\'appel. Veuillez réessayer.');
        
        res.type('text/xml');
        res.send(errorResponse.toString());
    }
});

// Route de fallback améliorée
app.post('/fallback', (req, res) => {
    console.log('Fallback appelé:', req.body);
    
    const twiml = new VoiceResponse();
    twiml.say({
        language: 'fr-FR',
        voice: 'woman'
    }, 'Une erreur est survenue. Veuillez réessayer plus tard.');
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Route de status améliorée
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
    res.status(500).json({
        error: 'Erreur serveur',
        message: err.message
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
    console.log(`URL webhook: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`}`);
    console.log('Numéro Twilio configuré:', '+32460205680');
});