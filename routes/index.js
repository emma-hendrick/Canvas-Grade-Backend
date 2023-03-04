const routes = require('express').Router();
const grades = require('../controllers/gradeController.js');

routes.get(
  '/',
  grades.getGrades
);

module.exports = routes;
