import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import api from "../api/axios";
import { getStoredUser } from "../utils/storage";

export const DISCOVERY_PROGRESS_UPDATED = "discovery-progress-updated";

const STEPS = [
  {
    key: "riasec",
    number: "01",
    label: "RIASEC",
    description: "Sở thích nghề nghiệp",
    to: "/discovery/riasec",
  },
  {
    key: "coreQuiz",
    number: "02",
    label: "Core Quiz",
    description: "Điểm mạnh và cách học",
    to: "/discovery/core-quiz",
  },
  {
    key: "aiDiscovery",
    number: "03",
    label: "AI Discovery",
    description: "Trò chuyện cùng AI",
    to: "/discovery/ai-discovery",
  },
  {
    key: "dashboard",
    number: "04",
    label: "Tong ket",
    description: "Ho so ban than",
    to: "/discovery/dashboard",
  },
  {
    key: "recommendations",
    number: "05",
    label: "Gợi ý nghề",
    description: "Khám phá hướng đi",
    to: "/discovery/recommendations",
  },
];

const EMPTY_PROGRESS = {
  riasec: false,
  coreQuiz: false,
  aiDiscovery: false,
  dashboard: false,
  recommendations: false,
};

function getProgress(profile, recommendationsViewed = false) {
  const hasElementScores = profile?.elementScores?.some(
    (element) => Number(element.finalScore) > 0
  );

  return {
    riasec: Boolean(profile?.riasecCompletedAt || profile?.riasecCode),
    coreQuiz: Boolean(profile?.coreQuizCompletedAt),
    aiDiscovery: Boolean(profile?.aiDiscoveries?.length),
    dashboard: Boolean(hasElementScores && profile?.riasecCode),
    recommendations: Boolean(hasElementScores && recommendationsViewed),
  };
}

function DiscoveryWorkflowLayout() {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  const recommendationsViewedKey = `discovery-recommendations-viewed:${user.id || "guest"}`;
  const [progress, setProgress] = useState(EMPTY_PROGRESS);

  const loadProgress = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await api.get("/profile");
      setProgress(
        getProgress(
          response.data,
          localStorage.getItem(recommendationsViewedKey) === "true"
        )
      );
    } catch {
      setProgress(EMPTY_PROGRESS);
    }
  }, [recommendationsViewedKey, token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let ignore = false;
    const isRecommendationsPage =
      location.pathname === "/discovery/recommendations";

    if (isRecommendationsPage) {
      localStorage.setItem(recommendationsViewedKey, "true");
    }

    api
      .get("/profile")
      .then((response) => {
        if (!ignore) {
          setProgress(
            getProgress(
              response.data,
              isRecommendationsPage ||
                localStorage.getItem(recommendationsViewedKey) === "true"
            )
          );
        }
      })
      .catch(() => {
        if (!ignore) {
          setProgress(EMPTY_PROGRESS);
        }
      });

    return () => {
      ignore = true;
    };
  }, [location.pathname, recommendationsViewedKey, token]);

  useEffect(() => {
    window.addEventListener(DISCOVERY_PROGRESS_UPDATED, loadProgress);

    return () => {
      window.removeEventListener(DISCOVERY_PROGRESS_UPDATED, loadProgress);
    };
  }, [loadProgress]);

  const completedCount = Object.values(progress).filter(Boolean).length;

  return (
    <div className="discovery-workflow">
      <header className="discovery-workflow-heading">
        <div>
          <p>Hành trình khám phá nghề nghiệp</p>
          <h1>Từng bước hiểu bản thân, chọn hướng đi phù hợp</h1>
        </div>
        <span>{completedCount}/{STEPS.length} bước đã hoàn thành</span>
      </header>

      <nav className="discovery-stepper" aria-label="Các bước khám phá nghề nghiệp">
        {STEPS.map((step) => (
          <NavLink
            className={({ isActive }) =>
              [
                "discovery-step",
                isActive ? "active" : "",
                progress[step.key] ? "completed" : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
            key={step.key}
            to={step.to}
          >
            <span className="discovery-step-number">
              {progress[step.key] ? "✓" : step.number}
            </span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="discovery-workflow-content">
        <Outlet />
      </div>
    </div>
  );
}

export default DiscoveryWorkflowLayout;
