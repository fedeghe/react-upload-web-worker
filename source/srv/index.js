const express = require('express');
const fileUpload = require('express-fileupload');
const slowDown = require("express-slow-down");
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const app = express();
var upload = multer();
// const speedLimiter = slowDown({
//     delayMs: 1000
// });

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

// app.use(speedLimiter);


app.use(cors());

app.use(upload.array());
// app.use(bodyParser.json());
// app.use(bodyParser.raw({type: 'application/octet-stream'}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
// app.use(morgan('dev'));

const port = process.env.PORT || 3000;

app.put('/upload', async (req, res) => {
    const fileName = req.query.fileName
    req.pipe(
        fs.createWriteStream(path.resolve(`${__dirname}/uploads/${fileName}`))
    ).on(
        'finish',
        () => res.sendStatus(200)
    )
});

app.post('/upload', async (req, res) => {
    console.log(req)
    console.log('BODY: \n\n', req.body)
    try {
        if(!req.files) {
            console.log('No file uploaded')
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let data = []; 
            Object.values(req.files).forEach(file => {
                file.mv('./uploads/' + file.name);
                data.push({
                    name: file.name,
                    mimetype: file.mimetype,
                    size: file.size
                });
            })
            res.send({
                status: true,
                message: 'Files are uploaded',
                data: data
            });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});


app.listen(port, () =>
    console.log(`Upload e.p. is listening on port ${port}.`)
);

