const {
  createProfile,
  getProfile,
  updateProfile,
  updateRiasecResult,
} = require("../services/profile.service");

function sendProfileError(res, error) {
  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Server error",
    error: error.message,
  });
}

async function getMyProfile(req, res) {
  try {
    return res.json(await getProfile(req.user._id));
  } catch (error) {
    return sendProfileError(res, error);
  }
}

async function createMyProfile(req, res) {
  try {
    const profile = await createProfile(req.user._id, req.body);

    return res.status(201).json({
      message: "Profile created successfully",
      profile,
    });
  } catch (error) {
    return sendProfileError(res, error);
  }
}

async function updateMyRiasec(req, res) {
  try {
    const profile = await updateRiasecResult(req.user._id, req.body);

    return res.json({
      message: "RIASEC result saved successfully",
      profile,
    });
  } catch (error) {
    return sendProfileError(res, error);
  }
}

async function updateMyProfile(req, res) {
  try {
    const profile = await updateProfile(req.user._id, req.body);

    return res.json({
      message: "Profile updated successfully",
      profile,
    });
  } catch (error) {
    return sendProfileError(res, error);
  }
}

module.exports = {
  createMyProfile,
  getMyProfile,
  updateMyProfile,
  updateMyRiasec,
};
