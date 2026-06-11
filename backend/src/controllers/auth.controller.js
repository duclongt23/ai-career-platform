const {
  createAdminUser,
  loginUser,
  logoutAuthSession,
  refreshAuthSession,
  registerStudent,
} = require("../services/auth.service");

function sendAuthError(res, error) {
  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Server error",
    error: error.message,
  });
}

async function register(req, res) {
  try {
    const authPayload = await registerStudent(req.body);

    return res.status(201).json({
      message: "Register successfully",
      ...authPayload,
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

async function login(req, res) {
  try {
    const authPayload = await loginUser(req.body);

    return res.json({
      message: "Login successfully",
      ...authPayload,
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

async function refresh(req, res) {
  try {
    return res.json(await refreshAuthSession(req.body.refreshToken));
  } catch (error) {
    return sendAuthError(res, error);
  }
}

async function logout(req, res) {
  try {
    await logoutAuthSession(req.body.refreshToken);

    return res.json({ message: "Logout successfully" });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

async function createAdmin(req, res) {
  try {
    const authPayload = await createAdminUser({
      ...req.body,
      providedSetupSecret:
        req.headers["x-admin-setup-secret"] || req.body.setupSecret,
    });

    return res.status(201).json({
      message: "Admin created successfully",
      ...authPayload,
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

function me(req, res) {
  return res.json({
    user: req.user,
  });
}

module.exports = {
  createAdmin,
  login,
  logout,
  me,
  refresh,
  register,
};
