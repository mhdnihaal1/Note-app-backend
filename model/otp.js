
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const otpSchema = new Schema({
     email:{type:String},
    otp:{type:String},
    expiresAt:{type:Date ,required: true, index: { expires: 0 }},
});
 
module.exports = mongoose.model('Otp',otpSchema)