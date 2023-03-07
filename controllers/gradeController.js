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

// This will call next(data, err) for the first {assignments} assignments from the canvas API
const forPastAssignments = async (next, assignments, courses) => {
    const assignmentsByCourse = courses.map(async (course) => {
        return axios.get(`${apiTarget}/users/self/courses/${course.id}/assignments?bucket=past&per_page=${assignments}`)
        .then(res => {

            return next(res.data, false, course.id);
        
        })
        .catch(err => {
        
            return next(null, err, course.id);
        
        });
    });

    // Wait for all of the api calls to complete, then return the completed results
    return await Promise.all(assignmentsByCourse);
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

// Gets the names, descriptions, grading_types, grading_standard_ids, and rubrics for each assignment
const getAssignmentData = (data, err, course_id) => {
    if (data === null || data === []) return [];
    if (err) throw new Error(err);

    return {
        'course_id': course_id,
        'assignment_data': data.map((assignment) => {
            return {
                'id': assignment.id,
                'name': assignment.name,
                'description': assignment.description,
                //'grading_type': assignment.grading_type,
                //'rubric': assignment.rubric,
                //'rubric_title': assignment.rubric_settings?.title,
                'due_at': assignment.due_at,
                'points_possible': assignment.points_possible
            };
        })
    }
}

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

// Get the score for an individual assignment
const getAssignmentGrade = async (assignment, course_id) => {
    return axios.get(`${apiTarget}/courses/${course_id}/assignments/${assignment.id}/submissions/self`)
    .then(res => {
        if (res.data === null) {

            return (null);

        } 

        assignment.score = res.data.score || 0;
        return assignment;

    })
    .catch(err => {

        throw new Error(err);
    
    });
}

// Get the submissions for an array of courses, and append the grades to the assignment objects
const getAssignmentGrades = async (allAssignments) => {
    var assignmentsGrades = [];
    for (const assignments of allAssignments) {
        var assignmentGrades = [];
        for (const assignment of assignments.assignment_data) {
            assignmentGrades.push(getAssignmentGrade(assignment, assignments.course_id));
        };

        assignmentsGrades.push(
            {
                'course_id': assignments.course_id,
                'assignment_data': await Promise.all(assignmentGrades)
            });
    };

    return await Promise.all(assignmentsGrades);
};

// Grade a score percentage using the specified grading scheme
const grade = (grade_percentage, grading_scheme) => {
    grade_letter = '';
    for (var i = grading_scheme.length - 1; i >= 0; i--) {
        if (grade_percentage >= grading_scheme[i].value) {
            grade_letter = grading_scheme[i].name;
        }
        else {
            break;
        }
    }
    return grade_letter;
}

// Input the enrollments, courses, grading standards, and a default grading standard, and this will return a json object containing all of a students grades across all of their courses
const returnFromEnrollmentsByCourseId = (enrollments, courses, gradingStandards, defaultGradingStandard, assignmentGrades) => {
    return enrollments.map((enrollment) => {
        const courseIndex = courses.findIndex(course => course.id === enrollment.id);

        if (courseIndex === -1) {
            return null;
        }

        const courseGradingStandardsIndex = gradingStandards.findIndex(standards => standards.course_id === enrollment.id);
        const gradingStandardIndex = gradingStandards[courseGradingStandardsIndex].grading_schemes.findIndex(standard => standard.id === courses[courseIndex].grading_standard_id);

        const gradingStandard = (courseGradingStandardsIndex === -1 || gradingStandardIndex === -1) ? defaultGradingStandard: gradingStandards[courseGradingStandardsIndex].grading_schemes[gradingStandardIndex];

        grade_letter = grade(enrollment.grade_percentage, gradingStandard.grading_scheme);

        const assignmentIndex = assignmentGrades.findIndex(courseAssignments => courseAssignments.course_id === enrollment.id);
        const assignments = assignmentGrades[assignmentIndex];

        return {
            'course_id': enrollment.id,
            'course_name': courses[courseIndex].name,
            'grade_percentage': enrollment.grade_percentage,
            'grade_letter': grade_letter,
            'assignments': assignments.assignment_data
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
        
        // For the first 10000 active enrollment on canvas get the current grade and course id
        const gradesByEnrollments = forActiveEnrollments(getEnrollmentGrades, 1000);

        // For the first 10000 active course you are enrolled in get the course id and name
        const courses = await forActiveCourses(getCourseData, 1000);

        // Get the assignments for each course, along with their, names, descriptions, grading standards, and rubrics
        const assignmentData = forPastAssignments(getAssignmentData, 1000, courses);

        // Get the grading standards for each course
        const gradingStandardsByCourses = getCourseGradingStandards(courses);

        // Get the grade for each assignment
        const assignmentGrades = getAssignmentGrades(await assignmentData);

        // Map the course names, grades, and grading standards together
        const grades = returnFromEnrollmentsByCourseId(await gradesByEnrollments, courses, await gradingStandardsByCourses, defaultGradingStandard, await assignmentGrades);

        res.status(200).json(grades);

    } catch (err) {
        
        res.status(400).json({err: err.message});
    
    }
};

module.exports = {
  getGrades,
};
