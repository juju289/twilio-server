const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Route pour tester que le serveur fonctionne
app.get('/', (req, res) => {
    res.send('Serveur Twilio en fonctionnement !');
});

app.post('/voice', (req, res) => {
    const twiml = new VoiceResponse();
    const dial = twiml.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER || '+12568670449'  // Votre numéro Twilio
    });
    
    const to = req.body.To;
    if (to) {
        dial.number(to);
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

app.post('/fallback', (req, res) => {
    const twiml = new VoiceResponse();
    twiml.say('Une erreur est survenue. Veuillez réessayer plus tard.');
    
    res.type('text/xml');
    res.send(twiml.toString());
});

app.post('/status', (req, res) => {
    console.log('Status Callback:', req.body);
    res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
