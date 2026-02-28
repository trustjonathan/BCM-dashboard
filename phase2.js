// ====== CONFIG ======
const adminPassword = "7optimus10";
const firebaseConfig = {
  apiKey: "AIzaSyD_Bd9ovR8duNt4Oq1IShsHYMSurMZp99Q",
  authDomain: "bcm-tracker-70489.firebaseapp.com",
  projectId: "bcm-tracker-70489",
  storageBucket: "bcm-tracker-70489.appspot.com",
  messagingSenderId: "792897503314",
  appId: "1:792897503314:web:c479febcb0c4c039aa1f8b",
  measurementId: "G-VJ6995DSHW"
};

// ====== INITIALIZE FIREBASE ======
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ====== SELECT ELEMENTS ======
const loginBtn = document.getElementById("login-btn");
const teacherPasswordInput = document.getElementById("teacher-password");
const addStudentBtn = document.getElementById("add-student-btn");
const studentNameInput = document.getElementById("student-name-input");
const selectStudent = document.getElementById("select-student");
const subjectSelect = document.getElementById("subject-select");
const assessmentInput = document.getElementById("assessment-input");
const scoreInput = document.getElementById("score-input");
const submitScoreBtn = document.getElementById("submit-score-btn");
const exportBtn = document.getElementById("export-btn");
const rankingBody = document.getElementById("ranking-body");
const studentTrendSection = document.getElementById("student-trend-section");
const studentTrendTitle = document.getElementById("student-trend-title");

// ====== CHARTS ======
let classChart, studentTrendChart;

// ====== ADMIN LOGIN ======
loginBtn.addEventListener("click", () => {
  if (teacherPasswordInput.value === adminPassword) {
    showToast("Logged in as Admin", "success");
    enableAdminControls();
    teacherPasswordInput.value = "";
  } else {
    showToast("Wrong password", "error");
  }
});

function enableAdminControls() {
  addStudentBtn.disabled = false;
  studentNameInput.disabled = false;
  selectStudent.disabled = false;
  subjectSelect.disabled = false;
  assessmentInput.disabled = false;
  scoreInput.disabled = false;
  submitScoreBtn.disabled = false;
  exportBtn.disabled = false;
  document.body.classList.add("admin-enabled");
}

// ====== TOAST ======
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.getElementById("toast-container").appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ====== ADD STUDENT ======
addStudentBtn.addEventListener("click", async () => {
  const name = studentNameInput.value.trim();
  if (!name) return showToast("Enter a student name", "error");

  try {
    await db.collection("students").add({
      name,
      scores: { bio: [], chem: [], math: [] },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Added ${name}`, "success");
    studentNameInput.value = "";
    loadStudents();
  } catch (err) {
    console.error(err);
    showToast("Error adding student", "error");
  }
});

// ====== LOAD STUDENTS ======
async function loadStudents() {
  selectStudent.innerHTML = "";
  const snapshot = await db.collection("students").orderBy("name").get();
  snapshot.forEach(doc => {
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = doc.data().name;
    selectStudent.appendChild(option);
  });
  updateRanking();
  updateClassChart();
}

// ====== SUBMIT SCORE ======
submitScoreBtn.addEventListener("click", async () => {
  const studentId = selectStudent.value;
  const subject = subjectSelect.value;
  const assessment = assessmentInput.value.trim();
  const score = Number(scoreInput.value);

  if (!studentId || !subject || !assessment || isNaN(score))
    return showToast("Fill all fields correctly", "error");

  try {
    const studentRef = db.collection("students").doc(studentId);
    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) return showToast("Student not found", "error");

    const scores = studentDoc.data().scores;
    if (!scores[subject]) scores[subject] = [];
    scores[subject].push({
      assessment,
      score,
      date: new Date().toISOString().split("T")[0]
    });

    await studentRef.update({ scores });
    showToast("Score submitted", "success");
    assessmentInput.value = "";
    scoreInput.value = "";
    updateRanking();
    updateClassChart();
    renderStudentTrend(studentId);
  } catch (err) {
    console.error(err);
    showToast("Error submitting score", "error");
  }
});

// ====== DELETE STUDENT ======
async function deleteStudent(studentId) {
  if (!confirm("Are you sure you want to delete this student?")) return;
  try {
    await db.collection("students").doc(studentId).delete();
    showToast("Student deleted", "success");
    loadStudents();
  } catch (err) {
    console.error(err);
    showToast("Error deleting student", "error");
  }
}

// ====== UPDATE RANKING ======
async function updateRanking() {
  rankingBody.innerHTML = "";
  const snapshot = await db.collection("students").get();
  const students = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    let total = 0;
    Object.values(data.scores).forEach(arr => arr.forEach(s => total += s.score));
    students.push({ id: doc.id, name: data.name, total });
  });

  students.sort((a, b) => b.total - a.total);

  students.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="student-name" data-id="${s.id}">${s.name}</td>
      <td>${s.total}</td>
      <td><button class="delete-btn" onclick="deleteStudent('${s.id}')">Delete</button></td>
    `;
    rankingBody.appendChild(tr);
  });

  document.querySelectorAll(".student-name").forEach(el => {
    el.addEventListener("click", () => renderStudentTrend(el.dataset.id));
  });
}

// ====== STUDENT TREND CHART + AI FEEDBACK ======
async function renderStudentTrend(studentId) {
  const studentDoc = await db.collection("students").doc(studentId).get();
  if (!studentDoc.exists) return;
  const data = studentDoc.data();

  // Show trend section
  studentTrendSection.style.display = "block";
  studentTrendTitle.textContent = `${data.name}'s Performance Trend`;

  const subjects = ["bio", "chem", "math"];
  const labelsSet = new Set();
  subjects.forEach(sub => data.scores[sub].forEach(s => labelsSet.add(s.assessment)));
  const labels = Array.from(labelsSet);

  const datasets = subjects.map(sub => ({
    label: sub.charAt(0).toUpperCase() + sub.slice(1),
    data: labels.map(label => data.scores[sub].find(s => s.assessment === label)?.score || null),
    borderColor: sub === "bio" ? "#4e73df" : sub === "chem" ? "#ef4444" : "#1cc88a",
    backgroundColor: sub === "bio" ? "#4e73df33" : sub === "chem" ? "#ef444433" : "#1cc88a33",
    fill: true,
    tension: 0.3
  }));

  const ctx = document.getElementById("studentTrendChart").getContext("2d");
  if (studentTrendChart) studentTrendChart.destroy();
  studentTrendChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: `${data.name}'s Performance Trend` } }
    }
  });

  generateAIFeedback(data);
}

// ====== AI FEEDBACK ======
function generateAIFeedback(studentData) {
  const feedbackContainerId = "student-ai-feedback";
  let container = document.getElementById(feedbackContainerId);
  if (!container) {
    container = document.createElement("div");
    container.id = feedbackContainerId;
    container.className = "ai-feedback";
    studentTrendSection.appendChild(container);
  }

  let feedback = [];
  const subjects = ["bio", "chem", "math"];
  subjects.forEach(sub => {
    const scores = studentData.scores[sub].map(s => s.score);
    if (!scores.length) return;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    feedback.push(`${sub.charAt(0).toUpperCase() + sub.slice(1)} avg: ${avg.toFixed(1)}. ` +
      (avg < 50 ? "Needs improvement." : avg > 80 ? "Excellent performance!" : "Keep practicing."));
  });

  // Overall trend
  let totalScores = subjects.reduce((acc, sub) => acc.concat(studentData.scores[sub].map(s => s.score)), []);
  if (totalScores.length > 1) {
    const trend = totalScores[totalScores.length - 1] - totalScores[0];
    feedback.push(trend > 0 ? "Overall trend: Improving 📈" : trend < 0 ? "Overall trend: Declining 📉" : "Overall trend: Stable");
  }

  container.innerHTML = feedback.join("<br>");
}

// ====== CLASS CHART (STACKED) ======
async function updateClassChart() {
  const snapshot = await db.collection("students").get();
  const students = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    students.push({
      name: data.name,
      bio: data.scores.bio.reduce((a, s) => a + s.score, 0),
      chem: data.scores.chem.reduce((a, s) => a + s.score, 0),
      math: data.scores.math.reduce((a, s) => a + s.score, 0)
    });
  });

  const labels = students.map(s => s.name);
  const datasets = [
    { label: "Biology", data: students.map(s => s.bio), backgroundColor: "#4e73df" },
    { label: "Chemistry", data: students.map(s => s.chem), backgroundColor: "#ef4444" },
    { label: "Math", data: students.map(s => s.math), backgroundColor: "#1cc88a" }
  ];

  const ctx = document.getElementById("classChart").getContext("2d");
  if (classChart) classChart.destroy();
  classChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "Class Total Scores by Subject" } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });

  // Update KPIs
  document.getElementById("kpi-size").textContent = students.length;
  const totalScores = students.map(s => s.bio + s.chem + s.math);
  const avg = students.length ? (totalScores.reduce((a, b) => a + b, 0) / students.length).toFixed(2) : 0;
  document.getElementById("kpi-average").textContent = avg;
  document.getElementById("kpi-best").textContent = students.sort((a, b) => (b.bio + b.chem + b.math) - (a.bio + a.chem + a.math))[0]?.name || "-";
  document.getElementById("kpi-improved").textContent = students[1]?.name || "-";
}

// ====== EXPORT CSV ======
exportBtn.addEventListener("click", async () => {
  const snapshot = await db.collection("students").get();
  let csv = "Name,Assessment,Biology,Chemistry,Math,Date\n";

  snapshot.forEach(doc => {
    const data = doc.data();
    const allAssessments = new Set();
    ["bio", "chem", "math"].forEach(sub => data.scores[sub].forEach(s => allAssessments.add(s.assessment)));
    Array.from(allAssessments).forEach(ass => {
      const bioScore = data.scores.bio.find(s => s.assessment === ass)?.score || "";
      const chemScore = data.scores.chem.find(s => s.assessment === ass)?.score || "";
      const mathScore = data.scores.math.find(s => s.assessment === ass)?.score || "";
      const date = data.scores.bio.find(s => s.assessment === ass)?.date || "";
      csv += `${data.name},${ass},${bioScore},${chemScore},${mathScore},${date}\n`;
    });
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bcm_scores.csv";
  a.click();
});

// ====== INITIAL LOAD ======
loadStudents();