const { collection } = require("../config/db");
const ObjectId = require("../utils/objectId");

const getTeacherCourses = async (req, res, next) => {
  try {
    const instructorId = new ObjectId(req.user.id);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const coursesCol = collection("courses");
    const [courses, total] = await Promise.all([
      coursesCol.find({ instructorId }).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      coursesCol.countDocuments({ instructorId }),
    ]);

    const data = courses.map((c) => ({
      id: c._id.toHexString(),
      title: c.title,
      description: c.description,
      category: c.category,
      level: c.level,
      duration: c.duration,
      lessons: c.lessonCount || c.lessons || 0,
      modules: c.modules || [],
      instructor: req.user.name,
      status: c.status || "draft",
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      publishedAt: c.publishedAt || null,
    }));

    const pages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getTeacherOverview = async (req, res, next) => {
  try {
    const instructorId = new ObjectId(req.user.id);
    const coursesCol = collection("courses");
    const courseRows = await coursesCol.find({ instructorId }, { projection: { _id: 1, status: 1 } }).toArray();

    const courseIds = courseRows.map((c) => c._id);
    let enrolledLearners = 0;
    let completedEnrollments = 0;

    if (courseIds.length) {
      const enrollments = await collection("enrollments")
        .find({ courseId: { $in: courseIds } })
        .toArray();

      enrolledLearners = enrollments.length;
      completedEnrollments = enrollments.filter((e) => e.status === "completed" || e.progress === 100).length;
    }

    return res.status(200).json({
      success: true,
      data: {
        courses: courseRows.length,
        publishedCourses: courseRows.filter((c) => c.status === "published").length,
        draftCourses: courseRows.filter((c) => c.status === "draft").length,
        enrolledLearners,
        completedEnrollments,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeacherCourses,
  getTeacherOverview,
};
