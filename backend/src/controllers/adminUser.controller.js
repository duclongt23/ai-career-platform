const {
  listUsers: listUsersService,
  updateUser: updateUserService,
} = require("../services/adminUser.service");

async function listUsers(req, res) {
  try {
    return res.json(await listUsersService(req.query));
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load users",
      error: error.message,
    });
  }
}

async function updateUser(req, res) {
  try {
    const user = await updateUserService(
      req.params.id,
      req.body,
      req.user._id
    );

    return res.json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.statusCode ? error.message : "Failed to update user",
      error: error.message,
    });
  }
}

module.exports = {
  listUsers,
  updateUser,
};
