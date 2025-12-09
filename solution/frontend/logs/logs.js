const USE_MOCK_DATA = false;
let allLogs = [];

// =========================================================
// 필터 상태 객체
// =========================================================
const agentFilters = {
  startDate: "",
  endDate: "",
  agentIds: [],
  toolNames: [],
  policies: [],
  query: "",
};

// [수정] 레지스트리 필터: 동작(CRUD) 및 검색어
const registryFilters = {
  startDate: "",
  endDate: "",
  query: "",
  ops: [], // 동작 (Create, Read...)
  statuses: [], // 상태 코드 (200, 404...)
  stages: [], // 검증 단계 (JWT, Schema...)
};

let currentView = "view-agent";

// 툴 이름 추출 헬퍼 (로그 키 다양성 대응)
function getToolName(log = {}) {
  return (
    log.tool_name ||
    log.tool ||
    log.toolId ||
    log.toolid ||
    (log.tool_args && log.tool_args.tool_name) ||
    (log.extra && log.extra.tool_name) ||
    ""
  );
}

// =========================================================
// 초기화 및 이벤트 리스너
// =========================================================
(function init() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
  } else {
    startApp();
  }
})();

function startApp() {
  setupTabs();
  setupFilters();
  setupModal();
  setupExportButtons();
  fetchLogs();

  // 드롭다운 외부 클릭 시 닫기
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown-wrapper")) {
      document
        .querySelectorAll(".dropdown-list")
        .forEach((list) => list.classList.remove("active"));
    }
  });
}

function setupTabs() {
  const tabBtns = document.querySelectorAll(".main-tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const targetId = btn.dataset.target;
      document
        .querySelectorAll(".tab-view")
        .forEach((view) => view.classList.add("hidden"));
      document.getElementById(targetId).classList.remove("hidden");
      currentView = targetId;
      renderCurrentView();
    });
  });

  const refreshBtn = document.getElementById("refresh-logs");
  if (refreshBtn) refreshBtn.onclick = () => fetchLogs();

  const refreshRegBtn = document.getElementById("refresh-registry");
  if (refreshRegBtn) refreshRegBtn.onclick = () => fetchLogs();
}

function setupExportButtons() {
  const exportAgentBtn = document.getElementById("export-agent-csv");
  if (exportAgentBtn) {
    exportAgentBtn.onclick = () => {
      const logs = getFilteredAgentLogs();
      exportToCsv(
        "agent-logs.csv",
        ["시간", "에이전트/툴", "정책 유형", "메시지"],
        logs.map((log) => [
          formatTime(log.timestamp),
          log.policy === "에이전트 접근"
            ? log.target_name || ""
            : `${log.agent_id} / ${log.tool_name || "-"}`,
          log.policy,
          log.message,
        ])
      );
    };
  }

  const exportRegistryBtn = document.getElementById("export-registry-csv");
  if (exportRegistryBtn) {
    exportRegistryBtn.onclick = () => {
      const logs = getFilteredRegistryLogs();
      exportToCsv(
        "registry-logs.csv",
        ["시간", "요청자", "동작", "상태 코드", "검증 단계", "메시지"],
        logs.map((log) => [
          formatTime(log.timestamp),
          log.actor,
          log.method,
          log.status,
          log.fail_stage || "",
          log.message,
        ])
      );
    };
  }
}

// =========================================================
// 커스텀 드롭다운 로직 (에이전트 탭용)
// =========================================================
function setupDropdown(wrapperId, onChangeCallback) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;

  const btn = wrapper.querySelector(".dropdown-btn");
  const list = wrapper.querySelector(".dropdown-list");

  btn.addEventListener("click", () => {
    if (wrapper.classList.contains("disabled")) return;
    document.querySelectorAll(".dropdown-list").forEach((l) => {
      if (l !== list) l.classList.remove("active");
    });
    list.classList.toggle("active");
  });

  list.addEventListener("change", () => {
    updateDropdownLabel(wrapper);
    if (onChangeCallback) onChangeCallback();
  });
}

function updateDropdownLabel(wrapper) {
  const checkboxes = wrapper.querySelectorAll('input[type="checkbox"]');
  const checked = wrapper.querySelectorAll('input[type="checkbox"]:checked');
  const btn = wrapper.querySelector(".dropdown-btn");

  if (checked.length === 0) {
    btn.textContent = "선택 안 함";
    btn.style.color = "#94a3b8";
  } else if (checked.length === checkboxes.length) {
    btn.textContent = "전체 선택";
    btn.style.color = "#fff";
  } else {
    if (checked.length === 1) {
      btn.textContent = checked[0].parentNode.textContent.trim();
    } else {
      btn.textContent = `${checked.length}개 선택됨`;
    }
    btn.style.color = "#fff";
  }
}

// =========================================================
// 필터 설정
// =========================================================
function setupFilters() {
  // 1. [에이전트] Flatpickr (날짜)
  const fpOptions = {
    enableTime: true,
    enableSeconds: true,
    dateFormat: "Y-m-d H:i:S",
    time_24hr: true,
    locale: "ko",
    disableMobile: true,
    onChange: (d, dateStr, instance) => {
      if (instance.element.id === "agent-date-start")
        agentFilters.startDate = dateStr;
      else agentFilters.endDate = dateStr;
      renderAgentView();
    },
  };
  flatpickr("#agent-date-start", fpOptions);
  flatpickr("#agent-date-end", fpOptions);

  if (typeof flatpickr !== "undefined") {
    const regFpOptions = {
      enableTime: true,
      enableSeconds: true,
      dateFormat: "Y-m-d H:i:S",
      time_24hr: true,
      locale: "ko",
      disableMobile: true,
      onChange: (d, dateStr, instance) => {
        if (instance.element.id === "registry-date-start")
          registryFilters.startDate = dateStr;
        else registryFilters.endDate = dateStr;
        renderRegistryView();
      },
    };
    flatpickr("#registry-date-start", regFpOptions);
    flatpickr("#registry-date-end", regFpOptions);
  }

  // [수정 3] 레지스트리 검색 버튼 이벤트
  const regSearchBtn = document.getElementById("registry-search-btn");
  if (regSearchBtn) {
    regSearchBtn.onclick = () => {
      registryFilters.query = document
        .getElementById("registry-search")
        .value.toLowerCase();
      renderRegistryView();
    };
  }

  // [수정 4] 레지스트리 초기화 버튼 이벤트
  const regResetBtn = document.getElementById("registry-filter-reset");
  if (regResetBtn) {
    regResetBtn.onclick = () => {
      // 1. 날짜 입력창 초기화
      const startEl = document.getElementById("registry-date-start");
      const endEl = document.getElementById("registry-date-end");
      if (startEl && startEl._flatpickr) startEl._flatpickr.clear();
      if (endEl && endEl._flatpickr) endEl._flatpickr.clear();

      // 2. 검색창 초기화
      document.getElementById("registry-search").value = "";

      // 3. 상태 값 초기화
      registryFilters.startDate = "";
      registryFilters.endDate = "";
      registryFilters.query = "";

      // 4. 드롭다운 및 필터 배열 초기화 (기존 함수 재사용)
      populateRegistryDropdowns();

      // 5. 뷰 갱신
      renderRegistryView();
    };
  }

  // 2. [에이전트] 드롭다운 설정
  setupDropdown("dropdown-agent", () => {
    const wrapper = document.getElementById("dropdown-agent");
    const checked = Array.from(wrapper.querySelectorAll("input:checked")).map(
      (c) => c.value
    );
    agentFilters.agentIds = checked;
    updateToolDropdown(checked);
    renderAgentView();
  });

  setupDropdown("dropdown-tool", () => {
    const wrapper = document.getElementById("dropdown-tool");
    const checked = Array.from(wrapper.querySelectorAll("input:checked")).map(
      (c) => c.value
    );
    agentFilters.toolNames = checked;
    renderAgentView();
  });

  setupDropdown("dropdown-policy", () => {
    const wrapper = document.getElementById("dropdown-policy");
    const checked = Array.from(wrapper.querySelectorAll("input:checked")).map(
      (c) => c.value
    );
    agentFilters.policies = checked;
    renderAgentView();
  });

  // 3. [에이전트] 검색 및 초기화
  const searchInput = document.getElementById("agent-search");
  if (searchInput) {
    searchInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        agentFilters.query = e.target.value.toLowerCase();
        renderAgentView();
      }
    });
  }
  document.getElementById("agent-search-btn").onclick = () => {
    agentFilters.query = document
      .getElementById("agent-search")
      .value.toLowerCase();
    renderAgentView();
  };

  document.getElementById("agent-filter-reset").onclick = () => {
    // 날짜 리셋
    document.getElementById("agent-date-start")._flatpickr.clear();
    document.getElementById("agent-date-end")._flatpickr.clear();
    document.getElementById("agent-search").value = "";

    agentFilters.startDate = "";
    agentFilters.endDate = "";
    agentFilters.query = "";
    agentFilters.policies = ["에이전트 접근", "툴 접근"];

    populateDropdowns();
    const policyWrap = document.getElementById("dropdown-policy");
    policyWrap.querySelectorAll("input").forEach((c) => (c.checked = false));
    updateDropdownLabel(policyWrap);

    renderAgentView();
  };

  setupDropdown("dropdown-reg-op", () => {
    const wrapper = document.getElementById("dropdown-reg-op");
    registryFilters.ops = Array.from(
      wrapper.querySelectorAll("input:checked")
    ).map((c) => c.value);
    renderRegistryView();
  });

  setupDropdown("dropdown-reg-status", () => {
    const wrapper = document.getElementById("dropdown-reg-status");
    // 상태 코드는 숫자이므로 변환 필요할 수 있으나, value는 문자열로 처리됨
    registryFilters.statuses = Array.from(
      wrapper.querySelectorAll("input:checked")
    ).map((c) => c.value);
    renderRegistryView();
  });

  setupDropdown("dropdown-reg-stage", () => {
    const wrapper = document.getElementById("dropdown-reg-stage");
    registryFilters.stages = Array.from(
      wrapper.querySelectorAll("input:checked")
    ).map((c) => c.value);
    renderRegistryView();
  });

  // [수정] 레지스트리 검색
  const regSearchInput = document.getElementById("registry-search");
  if (regSearchInput) {
    regSearchInput.addEventListener("keyup", (e) => {
      // input -> keyup으로 변경 (엔터 처리 등 통일감)
      registryFilters.query = e.target.value.toLowerCase();
      renderRegistryView();
    });
  }
}

// =========================================================
// 데이터 로드 및 Mock 데이터 생성
// =========================================================
async function fetchLogs() {
  if (USE_MOCK_DATA) {
    allLogs = generateMockData(50);
  } else {
    try {
      const resp = await fetch("/api/logs");
      if (!resp.ok) throw new Error("failed to load logs");
      allLogs = await resp.json();
      // tool_name 필드가 비어있을 경우 다른 키에서 보강
      allLogs = allLogs.map((log) => {
        const t = getToolName(log);
        if (t && !log.tool_name) {
          return { ...log, tool_name: t };
        }
        return log;
      });
    } catch (e) {
      console.error("logs fetch failed, using mock data", e);
      allLogs = generateMockData(30);
    }
  }
  populateDropdowns();
  populateRegistryDropdowns();
  renderCurrentView();
}

// [에이전트] 드롭다운 데이터 채우기
function populateDropdowns() {
  const wrapper = document.getElementById("dropdown-agent");
  const list = wrapper.querySelector(".dropdown-list");

  const agents = new Set();
  allLogs.forEach((l) => {
    if (l.source === "agent" && l.agent_id) agents.add(l.agent_id);
  });
  const sorted = Array.from(agents).sort();

  list.innerHTML = "";
  if (sorted.length === 0) {
    list.innerHTML = '<div style="padding:10px; color:#999;">데이터 없음</div>';
  } else {
    sorted.forEach((agent) => {
      const label = document.createElement("label");
      label.className = "dropdown-item";
      label.innerHTML = `<input type="checkbox" value="${agent}"> ${agent}`;
      list.appendChild(label);
    });
  }

  updateToolDropdown([]);
  updateDropdownLabel(wrapper);
  agentFilters.agentIds = [];
  
  // 정책 유형 드롭다운 채우기 (policy_enforcement.py 스키마 기반)
  const policyWrapper = document.getElementById("dropdown-policy");
  if (policyWrapper) {
    const policyList = policyWrapper.querySelector(".dropdown-list");
    const policyTypes = new Set();
    allLogs.forEach((l) => {
      if (l.source === "agent" && l.policy_type) {
        policyTypes.add(getPolicyLabel(l.policy_type));
      }
    });
    
    policyList.innerHTML = "";
    const sortedPolicies = Array.from(policyTypes).sort();
    if (sortedPolicies.length === 0) {
      policyList.innerHTML = '<div style="padding:10px; color:#999;">데이터 없음</div>';
    } else {
      sortedPolicies.forEach((policy) => {
        const label = document.createElement("label");
        label.className = "dropdown-item";
        label.innerHTML = `<input type="checkbox" value="${policy}"> ${policy}`;
        policyList.appendChild(label);
      });
    }
    updateDropdownLabel(policyWrapper);
    agentFilters.policies = [];
  }
}

function populateRegistryDropdowns() {
  const regLogs = allLogs.filter((l) => l.source === "registry");

  // 1. 동작 (Operation)
  const ops = new Set(
    regLogs
      .map((l) => (l.method || "").trim())
      .filter((m) => m.length > 0)
  );
  fillDropdownList("dropdown-reg-op", Array.from(ops).sort());

  // 2. 상태 코드 (Status Code)
  const statuses = new Set(
    regLogs
      .map((l) => l.status)
      .filter((s) => s !== undefined && s !== null && String(s).trim() !== "")
  );
  fillDropdownList(
    "dropdown-reg-status",
    Array.from(statuses).sort((a, b) => a - b)
  );

  // 3. 검증 단계 (Stage)
  const stages = new Set(
    regLogs
      .map((l) => (l.fail_stage || "").trim())
      .filter((s) => s.length > 0)
  );
  fillDropdownList("dropdown-reg-stage", Array.from(stages).sort());

  // 초기화 시 전체 선택 상태가 아니므로 필터 배열 비우기 (또는 전체 선택 처리)
  // 여기서는 "선택 안 함" 상태로 시작 (데이터 전체 표시 로직은 render에서 처리)
  registryFilters.ops = [];
  registryFilters.statuses = [];
  registryFilters.stages = [];

  // UI 라벨 업데이트
  updateDropdownLabel(document.getElementById("dropdown-reg-op"));
  updateDropdownLabel(document.getElementById("dropdown-reg-status"));
  updateDropdownLabel(document.getElementById("dropdown-reg-stage"));
}

// [신규] 드롭다운 리스트 HTML 생성 도우미
function fillDropdownList(elementId, items) {
  const wrapper = document.getElementById(elementId);
  if (!wrapper) return;
  const list = wrapper.querySelector(".dropdown-list");
  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML = '<div style="padding:10px; color:#999;">데이터 없음</div>';
    return;
  }

  items.forEach((item) => {
    const label = document.createElement("label");
    label.className = "dropdown-item";
    // item이 null/undefined일 경우 대비
    const val = item !== undefined ? item : "";
    label.innerHTML = `<input type="checkbox" value="${val}"> ${val}`;
    list.appendChild(label);
  });
}

function getFilteredRegistryLogs() {
  let logs = allLogs.filter((l) => l.source === "registry");

  if (registryFilters.startDate) {
    logs = logs.filter(
      (l) =>
        l.timestamp.replace("T", " ").substring(0, 19) >=
        registryFilters.startDate
    );
  }
  if (registryFilters.endDate) {
    logs = logs.filter(
      (l) =>
        l.timestamp.replace("T", " ").substring(0, 19) <=
        registryFilters.endDate
    );
  }

  if (registryFilters.ops.length > 0) {
    logs = logs.filter((l) => registryFilters.ops.includes(l.method));
  }

  if (registryFilters.statuses.length > 0) {
    logs = logs.filter((l) =>
      registryFilters.statuses.includes(String(l.status))
    );
  }

  if (registryFilters.stages.length > 0) {
    logs = logs.filter((l) => registryFilters.stages.includes(l.fail_stage));
  }

  if (registryFilters.query) {
    logs = logs.filter(
      (l) =>
        l.actor.toLowerCase().includes(registryFilters.query) ||
        l.message.toLowerCase().includes(registryFilters.query)
    );
  }

  return logs;
}

// [수정] 레지스트리 렌더링 (다중 필터 적용)
function renderRegistryView() {
  const tbody = document.getElementById("tbody-registry");
  const tmpl = document.getElementById("tmpl-registry-row");
  tbody.innerHTML = "";

  const logs = getFilteredRegistryLogs();

  // 카운트 표시
  document.getElementById("registry-count").textContent = logs.length + "건";

  // 데이터 없을 때 처리
  if (logs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #94a3b8;">데이터가 없습니다.</td></tr>';
    return;
  }

  // 행 렌더링
  logs.forEach((log) => {
      const clone = tmpl.content.cloneNode(true);
      clone.querySelector(".col-time").textContent = formatTime(log.timestamp);
      clone.querySelector(".col-actor").textContent = log.actor;
      clone.querySelector(".col-method").textContent = log.method;

      const statusCell = clone.querySelector(".col-status");
      statusCell.textContent = log.status;
      statusCell.style.color = getStatusColor(log.status);
      statusCell.style.fontWeight = "bold";

    clone.querySelector(".col-stage").textContent = log.fail_stage || "-";
    clone.querySelector(".col-msg").textContent = log.message;
    clone.querySelector("button").onclick = () => openModal(log);
    tbody.appendChild(clone);
  });
}

// [에이전트] 툴 드롭다운 업데이트
function updateToolDropdown(selectedAgentIds) {
  const wrapper = document.getElementById("dropdown-tool");
  const btn = wrapper.querySelector(".dropdown-btn");
  const list = wrapper.querySelector(".dropdown-list");

  if (!selectedAgentIds || selectedAgentIds.length === 0) {
    wrapper.classList.add("disabled");
    btn.textContent = "에이전트 선택 필요";
    list.innerHTML = "";
    agentFilters.toolNames = [];
    return;
  }

  wrapper.classList.remove("disabled");

  const tools = new Set();
  allLogs.forEach((l) => {
    const toolName = getToolName(l).trim();
    if (
      l.source === "agent" &&
      selectedAgentIds.includes(l.agent_id) &&
      toolName
    ) {
      tools.add(toolName);
    }
  });

  list.innerHTML = "";
  if (tools.size === 0) {
    list.innerHTML = '<div style="padding:10px; color:#999;">툴 없음</div>';
    btn.textContent = "툴 없음";
    return;
  }

  Array.from(tools)
    .sort()
    .forEach((tool) => {
      const label = document.createElement("label");
      label.className = "dropdown-item";
      label.innerHTML = `<input type="checkbox" value="${tool}"> ${tool}`;
      list.appendChild(label);
    });

  updateDropdownLabel(wrapper);
  agentFilters.toolNames = [];
}

// =========================================================
// 렌더링 로직
// =========================================================
function getFilteredAgentLogs() {
  let logs = allLogs.filter((l) => l.source === "agent");

  if (agentFilters.startDate)
    logs = logs.filter(
      (l) =>
        l.timestamp.replace("T", " ").substring(0, 19) >= agentFilters.startDate
    );
  if (agentFilters.endDate)
    logs = logs.filter(
      (l) =>
        l.timestamp.replace("T", " ").substring(0, 19) <= agentFilters.endDate
    );

  if (agentFilters.agentIds.length > 0) {
    logs = logs.filter((l) => agentFilters.agentIds.includes(l.agent_id));
  }
  if (agentFilters.toolNames.length > 0) {
    logs = logs.filter((l) => agentFilters.toolNames.includes(getToolName(l)));
  }
  // policy_type 기반 필터링 (policy_enforcement.py 스키마 호환)
  if (agentFilters.policies.length > 0) {
    logs = logs.filter((l) => {
      const policyLabel = getPolicyLabel(l.policy_type);
      return agentFilters.policies.includes(policyLabel);
    });
  }
  if (agentFilters.query) {
    logs = logs.filter(
      (l) =>
        (l.message || "").toLowerCase().includes(agentFilters.query) ||
        (l.agent_id || "").toLowerCase().includes(agentFilters.query) ||
        (l.actor || "").toLowerCase().includes(agentFilters.query)
    );
  }

  return logs;
}

function renderCurrentView() {
  if (currentView === "view-agent") renderAgentView();
  else renderRegistryView();
}

function renderAgentView() {
  const tbody = document.getElementById("tbody-agent");
  const tmpl = document.getElementById("tmpl-agent-row");
  tbody.innerHTML = "";

  const logs = getFilteredAgentLogs();

  document.getElementById("agent-count").textContent = logs.length + "건";

  if (logs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #94a3b8;">검색 결과가 없습니다.</td></tr>';
    return;
  }

  logs.forEach((log) => {
    const clone = tmpl.content.cloneNode(true);
    clone.querySelector(".col-time").textContent = formatTime(log.timestamp);
    
    // 에이전트/툴 컬럼: policy_enforcement.py 스키마에 맞게 표시
    const agentCol = clone.querySelector(".col-agent");
    if (log.tool_name) {
      agentCol.textContent = `${log.agent_id || '-'} / ${log.tool_name}`;
    } else if (log.target_agent) {
      agentCol.textContent = `${log.agent_id || '-'} → ${log.target_agent}`;
    } else {
      agentCol.textContent = log.agent_id || '-';
    }
    
    // 정책 유형 (policy_type을 한글로 변환)
    clone.querySelector(".col-policy").textContent = getPolicyLabel(log.policy_type);
    
    // 메시지 (verdict 포함)
    const msgCol = clone.querySelector(".col-msg");
    const verdictBadge = getVerdictBadge(log.verdict);
    msgCol.innerHTML = `${verdictBadge} ${log.message || '-'}`;
    
    clone.querySelector("button").onclick = () => openModal(log);
    tbody.appendChild(clone);
  });
}

// policy_type을 한글 라벨로 변환
function getPolicyLabel(policyType) {
  const labels = {
    'prompt_validation': '프롬프트 검증',
    'tool_validation': '툴 접근',
    'replay_protection': '리플레이 방지',
    'agent_access': '에이전트 접근',
  };
  return labels[policyType] || policyType || '-';
}

// verdict를 배지로 변환
function getVerdictBadge(verdict) {
  if (!verdict) return '';
  const upper = verdict.toUpperCase();
  if (upper === 'PASS' || upper === 'SAFE' || upper === 'ALLOWED') {
    return '<span style="background:#22c55e;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:6px;">PASS</span>';
  } else if (upper === 'VIOLATION' || upper === 'BLOCKED' || upper === 'DENIED') {
    return '<span style="background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:6px;">BLOCKED</span>';
  }
  return `<span style="background:#64748b;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:6px;">${verdict}</span>`;
}

// [추가] 상태 코드별 색상 유틸리티
function getStatusColor(code) {
  if (code === 200 || code === 291) return "#4ade80"; // 성공 (녹색)
  if (code === 401 || code === 403 || code === 409) return "#f87171"; // 인증/권한/충돌 (적색)
  if (
    code === 400 ||
    code === 422 ||
    code === 413 ||
    code === 498 ||
    code === 404
  )
    return "#fbbf24"; // 클라이언트/데이터 오류 (황색)
  return "#cbd5e1"; // 기타
}

function formatTime(isoString) {
  return isoString.replace("T", " ").substring(0, 19);
}

function setupModal() {
  const modal = document.getElementById("log-modal");
  const closeBtn = document.getElementById("close-modal");
  if (closeBtn) closeBtn.onclick = () => modal.classList.add("hidden");
  if (modal)
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };
}

function openModal(data) {
  document.getElementById("modal-json").textContent = JSON.stringify(
    data,
    null,
    2
  );
  document.getElementById("log-modal").classList.remove("hidden");
}

function exportToCsv(filename, headers, rows) {
  const csvLines = [];
  if (headers && headers.length) {
    csvLines.push(headers.map(toCsvValue).join(","));
  }
  rows.forEach((row) => {
    csvLines.push(row.map(toCsvValue).join(","));
  });

  const csvContent = "\ufeff" + csvLines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toCsvValue(value) {
  const safeValue =
    value === null || value === undefined ? "" : String(value).replace(/\"/g, '""');
  return /[\",\n]/.test(safeValue) ? `"${safeValue}"` : safeValue;
}

// =========================================================
// [수정] Mock 데이터 생성 (레지스트리 CRUD 시나리오 반영)
// =========================================================
function generateMockData(count) {
  const logs = [];

  // 에이전트 로그용 데이터셋
  const agentProfiles = {
    "HQ-Server": ["Wireshark", "SysInternals", "ProcessHacker"],
    "Dev-PC-01": ["VSCode", "Git", "Postman", "Docker"],
    "Finance-L02": ["Excel_Macro", "SAP_Client"],
    "Gateway-A": ["Nmap", "Tcpdump", "NetCat"],
  };
  const agents = Object.keys(agentProfiles);
  const targetAgents = ["Agent-Team-A", "Agent-Team-B", "Backup-Server"];
  const users = ["admin", "guest", "developer", "manager"];
  const policies = ["에이전트 접근", "툴 접근"];

  for (let i = 0; i < count; i++) {
    // 날짜 생성
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - Math.floor(Math.random() * 30));
    pastDate.setHours(
      Math.floor(Math.random() * 24),
      Math.floor(Math.random() * 60),
      Math.floor(Math.random() * 60)
    );
    const timestamp = pastDate.toISOString();

    // 50:50 확률로 레지스트리 vs 에이전트 로그 생성
    const isRegistry = i % 2 !== 0;

    if (isRegistry) {
      // [신규] 레지스트리(에이전트 카드 DB) 로그 생성
      logs.push(generateRegistryLog(i, timestamp));
    } else {
      // [기존] 에이전트 접근 로그
      const user = users[Math.floor(Math.random() * users.length)];
      const agentId = agents[Math.floor(Math.random() * agents.length)];
      const policy = policies[Math.floor(Math.random() * policies.length)];

      const log = {
        id: i,
        source: "agent",
        timestamp: timestamp,
        agent_id: agentId,
        user: user,
        policy: policy,
        message: "",
      };

      if (policy === "에이전트 접근") {
        log.target_name =
          targetAgents[Math.floor(Math.random() * targetAgents.length)];
        log.message = `User '${user}' accessed Agent '${log.target_name}'`;
      } else {
        const availableTools = agentProfiles[agentId];
        log.tool_name =
          availableTools[Math.floor(Math.random() * availableTools.length)];
        log.message = `User '${user}' accessed Tool '${log.tool_name}'`;
      }
      logs.push(log);
    }
  }
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// [신규] 상세 요구사항을 반영한 레지스트리 로그 생성 함수
function generateRegistryLog(id, timestamp) {
  const methods = ["Create", "Read", "Update", "Delete"];
  const method = methods[Math.floor(Math.random() * methods.length)];
  const actors = ["Auth-Server", "Manager-Web", "Agent-Client", "Unknown-User"];
  const actor = actors[Math.floor(Math.random() * actors.length)];

  let status = 200;
  let fail_stage = "";
  let message = "Request processed successfully";

  // 확률 난수 (0~1)
  const r = Math.random();

  // 1. JWT 토큰 검사 (모든 요청 공통, 10% 확률 실패)
  if (r < 0.1) {
    fail_stage = "JWT 토큰 검사";
    const errors = [
      { code: 401, msg: "Token Missing or Invalid Format" },
      { code: 401, msg: "Token Expired" },
      { code: 403, msg: "Token Permission Mismatch" },
    ];
    const err = errors[Math.floor(Math.random() * errors.length)];
    status = err.code;
    message = err.msg;
    return {
      id,
      source: "registry",
      timestamp,
      actor,
      method,
      status,
      fail_stage,
      message,
    };
  }

  // 2. 요청별 로직 분기
  switch (method) {
    case "Create":
      // [Create 흐름] JWT(통과) -> 스키마 -> 정책 -> 노드 개수 -> 성공(291)

      if (r < 0.3) {
        // 스키마 검증 실패 (20% 확률)
        fail_stage = "스키마 검증";
        const errors = [
          { code: 400, msg: "JSON Syntax Error" },
          { code: 422, msg: "Required Field Missing" },
          { code: 413, msg: "Max Bytes Exceeded" },
          { code: 498, msg: "Signature Field JWS Mismatch" },
        ];
        const err = errors[Math.floor(Math.random() * errors.length)];
        status = err.code;
        message = err.msg;
      } else if (r < 0.4) {
        // 정책 검사 실패 (10% 확률)
        fail_stage = "정책 검사";
        const errors = [
          { code: 409, msg: "Conflict: Duplicate Name/URL" },
          { code: 403, msg: "Unknown URL Policy" },
        ];
        const err = errors[Math.floor(Math.random() * errors.length)];
        status = err.code;
        message = err.msg;
      } else if (r < 0.5) {
        // 노드 개수 검사 실패 (10% 확률)
        fail_stage = "노드 개수 검사";
        status = 422;
        message = "Node Count Exceeds Range";
      } else {
        // 성공
        status = 291; // 요구사항: Create 성공 시 291
        message = "Agent Card Registered Successfully";
        fail_stage = "Success";
      }
      break;

    case "Read":
      // [Read 흐름] JWT(통과) -> 성공(200)
      status = 200;
      message = "Agent Card Retrieved";
      fail_stage = "Success";
      break;

    case "Update":
      // [Update 흐름] JWT(통과) -> 스키마 -> 정책 -> 존재여부 -> 성공
      if (r < 0.3) {
        fail_stage = "스키마 검증";
        status = 422;
        message = "Required Field Missing (Update)";
      } else if (r < 0.4) {
        fail_stage = "정책 검사";
        status = 409;
        message = "Conflict: Name already exists";
      } else if (r < 0.5) {
        fail_stage = "리소스 검사";
        status = 404;
        message = "Target Agent Card Not Found";
      } else {
        status = 200;
        message = "Agent Card Updated";
        fail_stage = "Success";
      }
      break;

    case "Delete":
      // [Delete 흐름] JWT(통과) -> 존재여부 -> 성공
      if (r < 0.2) {
        fail_stage = "리소스 검사";
        status = 404;
        message = "Target Agent Card Not Found";
      } else {
        status = 200;
        message = "Agent Card Deleted";
        fail_stage = "Success";
      }
      break;
  }

  return {
    id,
    source: "registry",
    timestamp,
    actor,
    method,
    status,
    fail_stage,
    message,
  };
}
