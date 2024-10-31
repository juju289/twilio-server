const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const app = express();

// Important: Ajout des headers CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Route de test
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Route principale pour les appels
app.post('/voice', (req, res) => {
    console.log('Voice webhook called with body:', req.body);
    
    const twiml = new VoiceResponse();
    
    try {
        const dial = twiml.dial({
            callerId: '+32460205680'
        });
        
        if (req.body.To) {
            dial.number(req.body.To);
        }
        
        console.log('Generated TwiML:', twiml.toString());
        
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error generating TwiML:', error);
        res.status(500).send('Error generating response');
    }
});

// Route de fallback
app.post('/fallback', (req, res) => {
    const twiml = new VoiceResponse();
    twiml.say('Une erreur est survenue. Veuillez réessayer plus tard.');
    res.type('text/xml');
    res.send(twiml.toString());
});

app.post('/status', (req, res) => {
    console.log('Call status update:', req.body);
    res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});