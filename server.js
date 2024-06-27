import express from "express";
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const urlencoded = require('body-parser').urlencoded;

const app = express();
const port = 3000;

app.use(urlencoded({ extended: false }));

app.all("/", (req, res) => {
    res.type('xml')
    const twiml = new VoiceResponse();
    twiml.say('Hello.');
    const gather = twiml.gather({
        input: 'dtmf',
        action: '/join',
        numDigits: 4
    });
    gather.say('Please enter the 4 digit room code.');
    res.send(twiml.toString());
});

const rooms = {};


function insertCharacter(str, n) {
    let val = [];
    let i, l;
    for (i = 0, l = str.length; i < l; i += n) {
        val.push(str.substr(i, n));
    }
 
    return val;
};

app.all("/join", (req, res) => {
    res.type('xml')
    const roomCode = req.body.Digits;
    const form = req.body.From
    const twiml = new VoiceResponse();
    if(!rooms[roomCode]) {
        rooms[roomCode] = {
            players: [],
            choices: {}
        }
    }

    const room = rooms[roomCode];


    var lastFour = form.substr(form.length - 4); // => "Tabs1"
    console.log(insertCharacter(lastFour, 1).join(''))

    if(room.players.length < 2) {
        const playerId = `${lastFour}`;
        room.players.push(playerId);
        room.choices[playerId] = null;

        if(room.players.length === 2) {
            twiml.redirect(`/play?room=${roomCode}&player=${playerId}`);
        } else {
            twiml.say(`Waiting for another player to join.`);
            twiml.redirect(`/wait?room=${roomCode}&player=${playerId}`);
        }
    } else {
        twiml.say('Room is full. Please enter a different room code.');
        twiml.redirect('/');
    }

    res.send(twiml.toString());

});


app.all("/wait", (req, res) => {
    res.type('xml');
    const twiml = new VoiceResponse();
    const roomCode = req.query.room;
    const playerId = req.query.player;

    if (rooms[roomCode].players.length === 2) {
        twiml.redirect(`/play?room=${roomCode}&player=${playerId}`);
    } else {
        twiml.say('Still waiting for another player.');
        twiml.pause({ length: 5 });
        twiml.redirect(`/wait?room=${roomCode}&player=${playerId}`);
    }

    res.send(twiml.toString());
});

app.all("/play", (req, res) => {
    res.type('xml');
    const twiml = new VoiceResponse();
    const roomCode = req.query.room;
    const playerId = req.query.player;

    twiml.say(`Your player ID is the last 4 digits of your number: "${insertCharacter(playerId, 1).join(' ')}".`);

    const gather = twiml.gather({
        input: 'dtmf',
        action: `/choice?room=${roomCode}&player=${playerId}`,
        numDigits: 1
    });
    gather.say('Press 1 for Rock, 2 for Paper, 3 for Scissors.');

    res.send(twiml.toString());
});

app.all("/choice", (req, res) => {
    res.type('xml');
    const twiml = new VoiceResponse();
    const roomCode = req.query.room;
    const playerId = req.query.player;
    const choice = req.body.Digits;

    const room = rooms[roomCode];
    room.choices[playerId] = choice;

    if (Object.values(room.choices).every(choice => choice !== null)) {
        // Both players have made their choices, determine the winner
        const [player1, player2] = room.players;
        const choice1 = room.choices[player1];
        const choice2 = room.choices[player2];
        const result = determineWinner(choice1, choice2);

        twiml.say(`Player 1 chose ${getChoiceName(choice1)}.`);
        twiml.say(`Player 2 chose ${getChoiceName(choice2)}.`);

        if (result === 0) {
            twiml.say('It\'s a tie!');
        } else if (result === 1) {
            twiml.say('Player 1 wins!');
        } else {
            twiml.say('Player 2 wins!');
        }

        // Clear the room
        startClearRoom(roomCode)
    } else {
        // Wait for the other player to make their choice
        twiml.say('Waiting for the other player.');
        twiml.redirect(`/waitChoice?room=${roomCode}&player=${playerId}`);
    }

    res.send(twiml.toString());
});

function startClearRoom(roomCode) {
    setTimeout(() => {
        delete rooms[roomCode];
    }, 60000);
}

app.all("/waitChoice", (req, res) => {
    res.type('xml');
    const twiml = new VoiceResponse();
    const roomCode = req.query.room;
    const playerId = req.query.player;


    if(!rooms[roomCode].choices || rooms[roomCode].choices === undefined) return;
    if (Object.values(rooms[roomCode].choices).every(choice => choice !== null)) {
        twiml.redirect(`/choice?room=${roomCode}&player=${playerId}`);
    } else {
        twiml.say('Still waiting for the other player.');
        twiml.pause({ length: 5 });
        twiml.redirect(`/waitChoice?room=${roomCode}&player=${playerId}`);
    }

    res.send(twiml.toString());
});


function determineWinner(choice1, choice2) {
    if (choice1 === choice2) return 0;
    if (
        (choice1 === '1' && choice2 === '3') ||
        (choice1 === '2' && choice2 === '1') ||
        (choice1 === '3' && choice2 === '2')
    ) {
        return 1;
    }
    return 2;
}

function getChoiceName(choice) {
    switch (choice) {
        case '1':
            return 'Rock';
        case '2':
            return 'Paper';
        case '3':
            return 'Scissors';
        default:
            return 'Unknown';
    }
}


app.listen(port, () => {
    console.log(`Listening on port ${port}...`);
});