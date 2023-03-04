const axios = require('axios');

// Private access token and apiTarget for Canvas API
const token = process.env.CANVAS_TOKEN;
const apiTarget = 'https://byui.instructure.com/api/v1';

// Sets our access token on all outgoing requests, as we will only be using axios to access the canvas API
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// This will call next(data, err) for the first {courses} courses from the canvas API
const forActiveCourses = async (next, courses) => {
    return axios.get(`${apiTarget}/courses?enrollment_state=active&per_page=${courses}`)
    .then(res => {
    
        return next(res.data, false);
    
    })
    .catch(err => {
    
        return next(null, err);
    
    });
};

// This will call next(data, err) for the first {enrollments} enrollments from the canvas API
const forActiveEnrollments = async (next, enrollments) => {
    return axios.get(`${apiTarget}/users/self/enrollments?per_page=${enrollments}`)
    .then(res => {
    
        return next(res.data, false);
    
    })
    .catch(err => {
    
        return next(null, err);
    
    });
};

// Gets the course ids, names, and grading_standard_ids for each course
const getCourseData = (data, err) => {
    if (data == null) return null;
    if (err) throw new Error(err);

    return data.map((course) => {
        return {
            'id': course.id,
            'name': course.name,
            'grading_standard_id': course.grading_standard_id,
        };
    });

};

// Gets the grades as a percentage and the course id from each enrollment
const getEnrollmentGrades = (data, err) => {
    if (data == null) return null;
    if (err) throw new Error(err);

    const enrollmentGrades = data.map((enrollment) => {
        return {
            'id': enrollment.course_id,
            'grade_percentage': enrollment.grades.current_score,
        };
    });

    return enrollmentGrades.filter((enrollment) => {
        return enrollment.grade_percentage != null;
    });

};

// Get the grading standards for an array of courses, and return it as an array of course_ids and grading_schemes (the grading schemes will be a sub-array)
const getCourseGradingStandards = async (courses) => {
    const standardsByCourse = courses.map(async (course) => {
        return axios.get(`${apiTarget}/courses/${course.id}/grading_standards`)
        .then(res => {
            if (res.data === null) {
                return null;
            }

            return {
                'course_id': course.id,
                'grading_schemes': res.data,
            };

        })
        .catch(err => {
        
            throw new Error(err);
        
        });
    });

    // Wait for all of the api calls to complete, then return the completed results
    return await Promise.all(standardsByCourse);
};

// Input the enrollments, courses, grading standards, and a default grading standard, and this will return a json object containing all of a students grades across all of their courses
const returnFromEnrollmentsByCourseId = (enrollments, courses, gradingStandards, defaultGradingStandard) => {
    return enrollments.map((enrollment) => {
        const courseIndex = courses.findIndex(course => course.id === enrollment.id);

        if (courseIndex === -1) {
            return null;
        }

        const courseGradingStandardsIndex = gradingStandards.findIndex(standards => standards.course_id === enrollment.id);
        const gradingStandardIndex = gradingStandards[courseGradingStandardsIndex].grading_schemes.findIndex(standard => standard.id === courses[courseIndex].grading_standard_id);

        const gradingStandard = (courseGradingStandardsIndex === -1 || gradingStandardIndex === -1) ? defaultGradingStandard: gradingStandards[courseGradingStandardsIndex].grading_schemes[gradingStandardIndex];

        grade_letter = '';
        for (var i = gradingStandard.grading_scheme.length - 1; i >= 0; i--) {
            if (enrollment.grade_percentage >= gradingStandard.grading_scheme[i].value) {
                grade_letter = gradingStandard.grading_scheme[i].name;
            }
        }

        return {
            'course_id': enrollment.id,
            'course_name': courses[courseIndex].name,
            'grade_percentage': enrollment.grade_percentage,
            'grade_letter': grade_letter,
        };
    });
};

// When this function is called, output the grades as a json response
const getGrades = async (req, res) => {
    try {

        const defaultGradingStandard = {
            'id': null,
            'grading_scheme': [
                {
                    'name': 'A',
                    'value': 94,
                },
                {
                    'name': 'A-',
                    'value': 90,
                },
                {
                    'name': 'B+',
                    'value': 87,
                },
                {
                    'name': 'B',
                    'value': 84,
                },
                {
                    'name': 'B-',
                    'value': 80,
                },
                {
                    'name': 'C+',
                    'value': 77,
                },
                {
                    'name': 'C',
                    'value': 74,
                },
                {
                    'name': 'C-',
                    'value': 70,
                },
                {
                    'name': 'D+',
                    'value': 67,
                },
                {
                    'name': 'D',
                    'value': 64,
                },
                {
                    'name': 'D-',
                    'value': 61,
                },
                {
                    'name': 'F',
                    'value': 0,
                },
            ]
        };
        
        const courses = await forActiveCourses(getCourseData, 100);
        const gradesByEnrollments = await forActiveEnrollments(getEnrollmentGrades, 100);
        const gradingStandardsByCourses = await getCourseGradingStandards(courses);
        const grades = returnFromEnrollmentsByCourseId(gradesByEnrollments, courses, gradingStandardsByCourses, defaultGradingStandard);

        res.status(200).json(grades);

    } catch (err) {
        
        res.status(400).json({err: err});
    
    }
};

module.exports = {
  getGrades,
};
