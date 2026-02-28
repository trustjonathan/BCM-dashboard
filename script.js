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

// ====== ADMIN LOGIN ======
loginBtn.addEventListener("click", () => {
  if (teacherPasswordInput.value === adminPassword) {
    showToast("Logged in as Admin");
    enableAdminControls();
    teacherPasswordInput.value = "";
  } else {
    showToast("Wrong password");
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
}

// ====== TOAST FUNCTION ======
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.getElementById("toast-container").appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ====== ADD STUDENT ======
addStudentBtn.addEventListener("click", async () => {
  const name = studentNameInput.value.trim();
  if (!name) return showToast("Enter a student name");

  try {
    const docRef = await db.collection("students").add({
      name: name,
      scores: { bio: [], chem: [], math: [] },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Added ${name}`);
    studentNameInput.value = "";
    loadStudents();
  } catch (err) {
    console.error(err);
    showToast("Error adding student");
  }
});

// ====== LOAD STUDENTS INTO DROPDOWN ======
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
  updateCharts();
}

// ====== SUBMIT SCORE ======
submitScoreBtn.addEventListener("click", async () => {
  const studentId = selectStudent.value;
  const subject = subjectSelect.value;
  const assessment = assessmentInput.value.trim();
  const score = Number(scoreInput.value);

  if (!studentId || !subject || !assessment || isNaN(score)) {
    return showToast("Fill all fields correctly");
  }

  try {
    const studentRef = db.collection("students").doc(studentId);
    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) return showToast("Student not found");

    const scores = studentDoc.data().scores;
    if (!scores[subject]) scores[subject] = [];
    scores[subject].push({ assessment, score });

    await studentRef.update({ scores });
    showToast("Score submitted");
    assessmentInput.value = "";
    scoreInput.value = "";
    updateRanking();
    updateCharts();
  } catch (err) {
    console.error(err);
    showToast("Error submitting score");
  }
});

// ====== DELETE STUDENT ======
async function deleteStudent(studentId) {
  if (!confirm("Are you sure you want to delete this student?")) return;
  try {
    await db.collection("students").doc(studentId).delete();
    showToast("Student deleted");
    loadStudents();
  } catch (err) {
    console.error(err);
    showToast("Error deleting student");
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
      <td>${s.name}</td>
      <td>${s.total}</td>
      <td><button onclick="deleteStudent('${s.id}')">Delete</button></td>
    `;
    rankingBody.appendChild(tr);
  });
}

// ====== CHARTS ======
let classChart, trendChart;

async function updateCharts() {
  const snapshot = await db.collection("students").get();
  const students = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    let total = 0;
    Object.values(data.scores).forEach(arr => arr.forEach(s => total += s.score));
    students.push({ name: data.name, total });
  });

  const labels = students.map(s => s.name);
  const data = students.map(s => s.total);

  if (classChart) classChart.destroy();
  const ctx = document.getElementById("classChart").getContext("2d");
  classChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Total Scores", data, backgroundColor: "#4e73df" }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Trend chart (top student progression)
  const trendCtx = document.getElementById("trendChart").getContext("2d");
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(trendCtx, {
    type: "line",
    data: { labels, datasets: [{ label: "Total Scores", data, borderColor: "#1cc88a", fill: false }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Update KPIs
  document.getElementById("kpi-size").textContent = students.length;
  const avg = students.length ? (data.reduce((a, b) => a + b, 0) / students.length).toFixed(2) : 0;
  document.getElementById("kpi-average").textContent = avg;
  const top = students[0] ? students[0].name : "-";
  document.getElementById("kpi-best").textContent = top;
  const improved = students.length > 1 ? students[1].name : "-";
  document.getElementById("kpi-improved").textContent = improved;
}

// ====== EXPORT CSV ======
exportBtn.addEventListener("click", async () => {
  const snapshot = await db.collection("students").get();
  let csv = "Name,Total Scores\n";
  snapshot.forEach(doc => {
    const data = doc.data();
    let total = 0;
    Object.values(data.scores).forEach(arr => arr.forEach(s => total += s.score));
    csv += `${data.name},${total}\n`;
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