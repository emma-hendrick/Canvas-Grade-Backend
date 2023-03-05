require('dotenv').config();
const PORT = process.env.PORT || 8080;

const cors = require('cors');
const express = require('express');
const app = express();

app.use(cors());
app.use('/', require('./routes'));

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
