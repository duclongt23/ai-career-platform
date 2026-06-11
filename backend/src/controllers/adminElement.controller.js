const {
  createElement: createElementService,
  deleteElement: deleteElementService,
  listElements: listElementsService,
  updateElement: updateElementService,
} = require("../services/adminElement.service");

function sendElementError(res, error, fallbackMessage, fallbackStatus = 500) {
  return res.status(error.statusCode || fallbackStatus).json({
    message: error.statusCode ? error.message : fallbackMessage,
    error: error.message,
    references: error.details,
  });
}

async function listElements(req, res) {
  try {
    return res.json(await listElementsService(req.query));
  } catch (error) {
    return sendElementError(res, error, "Failed to load elements");
  }
}

async function createElement(req, res) {
  try {
    const element = await createElementService(req.body);

    return res.status(201).json({
      message: "Element created successfully",
      element,
    });
  } catch (error) {
    return sendElementError(res, error, "Failed to create element", 400);
  }
}

async function updateElement(req, res) {
  try {
    const element = await updateElementService(req.params.id, req.body);

    return res.json({
      message: "Element updated successfully",
      element,
    });
  } catch (error) {
    return sendElementError(res, error, "Failed to update element", 400);
  }
}

async function deleteElement(req, res) {
  try {
    await deleteElementService(req.params.id);

    return res.json({
      message: "Element deleted successfully",
    });
  } catch (error) {
    return sendElementError(res, error, "Failed to delete element");
  }
}

module.exports = {
  createElement,
  deleteElement,
  listElements,
  updateElement,
};
