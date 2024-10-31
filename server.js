const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Route de test
app.get('/', (req, res) => {
    res.send('Twilio Voice Server Running');
});

// Route pour les appels
app.post('/voice', (req, res) => {
    console.log('Voice webhook called:', req.body);
    const twiml = new VoiceResponse();
    const dial = twiml.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER || '+32460205680'
    });
    
    if (req.body.To) {
        dial.number(req.body.To);
    }

    console.log('Responding with TwiML:', twiml.toString());
    res.type('text/xml');
    res.send(twiml.toString());
});

// Route de fallback
app.post('/fallback', (req, res) => {
    console.log('Fallback webhook called:', req.body);
    const twiml = new VoiceResponse();
    twiml.say('Une erreur est survenue. Veuillez réessayer plus tard.');
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Route pour les status
app.post('/status', (req, res) => {
    console.log('Status Callback:', req.body);
    res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});