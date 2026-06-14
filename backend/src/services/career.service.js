const Career = require("../models/Career");
const Element = require("../models/Element");
const User = require("../models/User");
const { createHttpError } = require("../utils/httpError");
const { escapeRegExp } = require("../utils/regex");

const RECOMMENDABLE_CAREER_FILTER = {
  is_active: true,
  student_suitable: true,
  "elements.0": { $exists: true },
};

async function addCareerElementNames(careers) {
  const codes = [
    ...new Set(
      careers
        .flatMap((career) => career.elements || [])
        .map((element) => element.code)
        .filter(Boolean)
    ),
  ];

  if (!codes.length) {
    return careers;
  }

  const elements = await Element.find({ code: { $in: codes } })
    .select("code name_vi name_en")
    .lean();
  const elementNameMap = new Map(
    elements.map((element) => [element.code, element])
  );

  return careers.map((career) => ({
    ...career,
    elements: (career.elements || []).map((element) => ({
      ...element,
      name_vi: elementNameMap.get(element.code)?.name_vi || "",
      name_en: elementNameMap.get(element.code)?.name_en || "",
    })),
  }));
}

async function searchCareerElements({ q, type }) {
  const query = {};

  if (type) {
    query.type = type;
  }

  if (q) {
    const searchPattern = { $regex: escapeRegExp(q), $options: "i" };

    query.$or = [
      { code: searchPattern },
      { name_vi: searchPattern },
      { name_en: searchPattern },
    ];
  }

  return Element.find(query)
    .select("code name_vi name_en type")
    .sort({ type: 1, name_vi: 1, name_en: 1 })
    .limit(12)
    .lean();
}

async function listAdminCareers({ search, status, page: rawPage, limit: rawLimit }) {
  const page = Math.max(Number.parseInt(rawPage, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(rawLimit, 10) || 50, 1),
    200
  );
  const filter = {};

  if (search) {
    const searchPattern = { $regex: escapeRegExp(search), $options: "i" };

    filter.$or = [
      { onetCode: searchPattern },
      { title_vi: searchPattern },
      { title_en: searchPattern },
      { aliases: searchPattern },
      { careerCluster: searchPattern },
    ];
  }

  if (status === "active") {
    filter.is_active = true;
  } else if (status === "inactive") {
    filter.is_active = false;
  } else if (status === "student_suitable") {
    filter.student_suitable = true;
  }

  const [careers, total] = await Promise.all([
    Career.find(filter)
      .sort({ updatedAt: -1, title_vi: 1, title_en: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Career.countDocuments(filter),
  ]);

  return {
    careers: await addCareerElementNames(careers),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function listCareers({ search, field, page: rawPage, limit: rawLimit }) {
  const page = Math.max(Number.parseInt(rawPage, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(rawLimit, 10) || 12, 1),
    24
  );
  const filter = {
    is_active: true,
    student_suitable: true,
  };

  if (search) {
    const searchPattern = { $regex: escapeRegExp(search), $options: "i" };

    filter.$or = [
      { title_vi: searchPattern },
      { title_en: searchPattern },
      { aliases: searchPattern },
      { description_vi: searchPattern },
    ];
  }

  if (field) {
    filter.careerCluster = { $regex: escapeRegExp(field), $options: "i" };
  }

  const [careers, total] = await Promise.all([
    Career.find(filter)
      .select("onetCode title_en title_vi description_vi careerCluster")
      .sort({ vietnam_relevance: -1, title_vi: 1, title_en: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Career.countDocuments(filter),
  ]);

  return {
    careers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getCareerDetails(careerId) {
  const career = await Career.findById(careerId).lean();

  if (!career) {
    throw createHttpError(404, "Career not found");
  }

  const elementCodes = (career.elements || []).map((element) => element.code);
  const elements = await Element.find({ code: { $in: elementCodes } })
    .select("code name_vi name_en")
    .lean();
  const elementNameMap = new Map(
    elements.map((element) => [element.code, element])
  );

  return {
    ...career,
    elements: (career.elements || []).map((element) => ({
      ...element,
      name_vi: elementNameMap.get(element.code)?.name_vi || element.code,
      name_en: elementNameMap.get(element.code)?.name_en || element.code,
    })),
  };
}

async function ensureCareerCanBeSaved(careerId) {
  const career = await Career.findOne({
    _id: careerId,
    is_active: true,
    student_suitable: true,
  })
    .select("_id")
    .lean();

  if (!career) {
    throw createHttpError(404, "Career not found");
  }

  return career;
}

async function isFavoriteCareer(userId, careerId) {
  await ensureCareerCanBeSaved(careerId);

  const user = await User.findOne({
    _id: userId,
    favoriteCareers: careerId,
  })
    .select("_id")
    .lean();

  return { isFavorite: Boolean(user) };
}

async function listFavoriteCareers(userId) {
  const user = await User.findById(userId)
    .select("favoriteCareers")
    .populate({
      path: "favoriteCareers",
      match: {
        is_active: true,
        student_suitable: true,
      },
      select: "onetCode title_en title_vi description_vi careerCluster updatedAt",
      options: {
        sort: { title_vi: 1, title_en: 1 },
      },
    })
    .lean();

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  return {
    careers: (user.favoriteCareers || []).filter(Boolean),
  };
}

async function saveFavoriteCareer(userId, careerId) {
  await ensureCareerCanBeSaved(careerId);

  await User.findByIdAndUpdate(userId, {
    $addToSet: { favoriteCareers: careerId },
  });

  return { isFavorite: true };
}

async function removeFavoriteCareer(userId, careerId) {
  await User.findByIdAndUpdate(userId, {
    $pull: { favoriteCareers: careerId },
  });

  return { isFavorite: false };
}

async function createCareer(payload) {
  return Career.create(payload);
}

async function updateCareer(careerId, payload) {
  const career = await Career.findByIdAndUpdate(careerId, payload, {
    new: true,
    runValidators: true,
  });

  if (!career) {
    throw createHttpError(404, "Career not found");
  }

  return career;
}

async function deleteCareer(careerId) {
  const career = await Career.findByIdAndDelete(careerId);

  if (!career) {
    throw createHttpError(404, "Career not found");
  }
}

module.exports = {
  RECOMMENDABLE_CAREER_FILTER,
  createCareer,
  deleteCareer,
  getCareerDetails,
  isFavoriteCareer,
  listAdminCareers,
  listCareers,
  listFavoriteCareers,
  removeFavoriteCareer,
  saveFavoriteCareer,
  searchCareerElements,
  updateCareer,
};
