const { collection } = require("../config/db");
const ObjectId = require("../utils/objectId");

async function recordAudit(actorId, action, targetType, targetId, metadata = {}) {
  try {
    await collection("auditLogs").insertOne({
      _id: new ObjectId(),
      actorId: new ObjectId(actorId),
      action,
      targetType,
      targetId: new ObjectId(targetId),
      metadata,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("Failed to record audit log:", err.message);
  }
}

const getAdminOverview = async (req, res, next) => {
  try {
    const usersCol = collection("users");
    const coursesCol = collection("courses");
    const enrollmentsCol = collection("enrollments");

    const [
      studentCount,
      teacherCount,
      adminCount,
      suspendedCount,
      publishedCourses,
      draftCourses,
      totalEnrollments,
    ] = await Promise.all([
      usersCol.countDocuments({ role: "student", status: { $ne: "suspended" } }),
      usersCol.countDocuments({ role: "teacher", status: { $ne: "suspended" } }),
      usersCol.countDocuments({ role: "admin", status: { $ne: "suspended" } }),
      usersCol.countDocuments({ status: "suspended" }),
      coursesCol.countDocuments({ status: "published" }),
      coursesCol.countDocuments({ status: "draft" }),
      enrollmentsCol.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users: {
          students: studentCount,
          teachers: teacherCount,
          admins: adminCount,
          suspended: suspendedCount,
        },
        courses: {
          published: publishedCourses,
          drafts: draftCourses,
        },
        enrollments: totalEnrollments,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAdminUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role && ["student", "teacher", "admin"].includes(req.query.role)) {
      filter.role = req.query.role;
    }
    if (req.query.status && ["active", "suspended"].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.q && typeof req.query.q === "string") {
      const q = req.query.q.trim();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const usersCol = collection("users");
    const [rows, total] = await Promise.all([
      usersCol.find(filter, { projection: { passwordHash: 0, password: 0 } })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      usersCol.countDocuments(filter),
    ]);

    const data = rows.map((u) => ({
      id: u._id.toHexString(),
      name: u.name,
      email: u.email,
      role: u.role || "student",
      status: u.status || "active",
      createdAt: u.createdAt,
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

const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (status !== "active" && status !== "suspended") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_STATUS", message: "Status must be 'active' or 'suspended'." },
      });
    }

    const rawId = req.params.userId;
    if (!ObjectId.isValid(rawId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "A valid user ID is required." },
      });
    }

    const targetId = new ObjectId(rawId);
    const actorId = new ObjectId(req.user.id);

    const usersCol = collection("users");
    const target = await usersCol.findOne({ _id: targetId });

    if (!target) {
      return res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found." },
      });
    }

    if (target.role === "admin" || targetId.equals(actorId)) {
      return res.status(403).json({
        success: false,
        error: { code: "PROTECTED_ACCOUNT", message: "Administrator accounts cannot be altered here." },
      });
    }

    await usersCol.updateOne({ _id: targetId }, { $set: { status, updatedAt: new Date() } });
    await recordAudit(actorId, `user.${status}`, "user", targetId);

    return res.status(200).json({
      success: true,
      data: { id: targetId.toHexString(), status },
    });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (role !== "student" && role !== "teacher") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ROLE", message: "Managed accounts can only be set to student or teacher." },
      });
    }

    const rawId = req.params.userId;
    if (!ObjectId.isValid(rawId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "A valid user ID is required." },
      });
    }

    const targetId = new ObjectId(rawId);
    const actorId = new ObjectId(req.user.id);

    const usersCol = collection("users");
    const target = await usersCol.findOne({ _id: targetId });

    if (!target) {
      return res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found." },
      });
    }

    if (target.role === "admin" || targetId.equals(actorId)) {
      return res.status(403).json({
        success: false,
        error: { code: "PROTECTED_ACCOUNT", message: "Administrator accounts cannot be altered here." },
      });
    }

    await usersCol.updateOne({ _id: targetId }, { $set: { role, updatedAt: new Date() } });
    await recordAudit(actorId, "user.role_changed", "user", targetId, { role });

    return res.status(200).json({
      success: true,
      data: { id: targetId.toHexString(), role },
    });
  } catch (error) {
    next(error);
  }
};

const getAuditLog = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const auditCol = collection("auditLogs");
    const [rows, total] = await Promise.all([
      auditCol.find({}).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      auditCol.countDocuments({}),
    ]);

    const actorIds = [];
    for (const r of rows) {
      if (r.actorId && ObjectId.isValid(r.actorId)) {
        const idStr = r.actorId.toHexString ? r.actorId.toHexString() : String(r.actorId);
        if (!actorIds.some((a) => a.toHexString() === idStr)) {
          actorIds.push(new ObjectId(idStr));
        }
      }
    }

    const actorMap = new Map();
    if (actorIds.length) {
      const users = await collection("users")
        .find({ _id: { $in: actorIds } }, { projection: { name: 1 } })
        .toArray();
      for (const u of users) {
        actorMap.set(u._id.toHexString(), u.name);
      }
    }

    const data = rows.map((r) => ({
      id: r._id.toHexString(),
      actor: r.actorId ? actorMap.get(r.actorId.toHexString()) || "Administrator" : "System",
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId ? r.targetId.toHexString() : "",
      metadata: r.metadata || {},
      createdAt: r.createdAt,
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

module.exports = {
  getAdminOverview,
  getAdminUsers,
  updateUserStatus,
  updateUserRole,
  getAuditLog,
};
