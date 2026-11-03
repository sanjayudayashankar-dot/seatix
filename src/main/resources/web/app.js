"use strict";

const movies = [
    { id: "interstellar", title: "Interstellar", genre: "Sci-fi · Adventure", rating: "8.7", poster: "/assets/posters/interstellar.png" },
    { id: "dark-knight", title: "The Dark Knight", genre: "Action · Crime", rating: "9.0", poster: "/assets/posters/dark-knight.png" },
    { id: "resident-evil", title: "Resident Evil", genre: "Action · Horror", rating: "7.4", poster: "/assets/posters/resident-evil.png" },
    { id: "jailer2", title: "Jailer 2", genre: "Action · Drama", rating: "8.1", poster: "/assets/posters/jailer2.png" },
    { id: "baththa", title: "Baththa", genre: "Action · Romance", rating: "7.2", poster: "/assets/posters/baththa.png" }
];

const priceTable = {
    standard: { standard: 260, premium: 380 },
    imax: { standard: 300, premium: 420 },
    orchestra: { standard: 350, premium: 500, mezzanine: 300, mezzaninePremium: 430, balcony: 250 }
};

const selectedSeatIds = new Set();
let activeMovie = movies[0];
let activeTime = "19:15";
let activeDate = "";
let activeLayout = "imax";
let currentSeats = [];
let renderer;
let toastTimeout;
let pendingBooking = null;
let bookingEnabled = false;

const movieShelf = document.querySelector("#movieShelf");
const seatList = document.querySelector("#selectedList");
const countLabel = document.querySelector("#selectedCount");
const ticketCount = document.querySelector("#ticketCount");
const ticketPrice = document.querySelector("#ticketPrice");
const feeLabel = document.querySelector("#convenienceFee");
const totalLabel = document.querySelector("#totalPrice");
const clearButton = document.querySelector("#clearSelection");
const continueButton = document.querySelector("#continueButton");
const bookingAvailability = document.querySelector("#bookingAvailability");
const layoutPicker = document.querySelector("#layoutPicker");
const toast = document.querySelector("#toast");
const seatTooltip = document.querySelector("#seatTooltip");
const contactDialog = document.querySelector("#contactDialog");
const contactForm = document.querySelector("#contactForm");
const contactFormError = document.querySelector("#contactFormError");
const createBookingButton = document.querySelector("#createBookingButton");
const paymentDialog = document.querySelector("#paymentDialog");
const paymentStatusPanel = document.querySelector("#paymentStatusPanel");
const paymentStatusTitle = document.querySelector("#paymentStatusTitle");
const paymentStatusMessage = document.querySelector("#paymentStatusMessage");
const paymentActions = document.querySelector("#paymentActions");
const retryPaymentButton = document.querySelector("#retryPayment");
const closePaymentButton = document.querySelector("#closePaymentDialog");

function renderMovieShelf() {
    movieShelf.replaceChildren();
    for (const movie of movies) {
        const card = document.createElement("button");
        card.className = "movie-card";
        card.type = "button";
        card.setAttribute("aria-pressed", String(movie.id === activeMovie.id));
        if (movie.id === activeMovie.id) card.classList.add("selected");

        const poster = document.createElement("img");
        poster.className = "movie-poster";
        poster.src = movie.poster;
        poster.alt = `${movie.title} poster`;
        poster.loading = "lazy";

        const copy = document.createElement("span");
        copy.className = "movie-copy";
        const title = document.createElement("span");
        title.className = "movie-title";
        title.textContent = movie.title;
        const genre = document.createElement("span");
        genre.className = "movie-genre";
        genre.textContent = movie.genre;
        const rating = document.createElement("span");
        rating.className = "movie-rating";
        rating.textContent = `★ ${movie.rating}  ·  4K`;
        copy.append(title, genre, rating);
        card.append(poster, copy);
        card.addEventListener("click", () => {
            activeMovie = movie;
            renderer?.setMovie(movie);
            renderMovieShelf();
            showToast(`${movie.title} selected`);
        });
        movieShelf.append(card);
    }
}

function makeSeat(layout, section, row, seatNumber, x, y, z, premium, unavailable) {
    const category = premium ? "premium" : "standard";
    const prices = priceTable[layout];
    const sectionPrice = layout === "orchestra" && section !== "Orchestra"
        ? section === "Mezzanine" && premium ? prices.mezzaninePremium : prices[section.toLowerCase()]
        : null;
    return {
        id: `${layout}-${section}-${row}-${seatNumber}`,
        section,
        row,
        seatNumber,
        x,
        y,
        z,
        category,
        price: sectionPrice ?? prices[category],
        unavailable
    };
}

function addThreeBlocks(seats, config) {
    const { layout, section, rows, y = 0, z = -8, spacing = 0.62, rowRise = 0.09, count = 30, premiumRows = [], accessible = false } = config;
    rows.forEach((row, rowIndex) => {
        const seatCount = typeof count === "function" ? count(rowIndex) : count;
        const leftSeats = Math.ceil(seatCount * 0.23);
        const rightSeats = Math.ceil(seatCount * 0.23);
        const centerSeats = seatCount - leftSeats - rightSeats;
        for (let seatNumber = 1; seatNumber <= seatCount; seatNumber++) {
            let x;
            let block;
            if (seatNumber <= leftSeats) {
                block = "Left";
                x = -12.6 + (seatNumber - 1) * spacing;
            } else if (seatNumber <= leftSeats + centerSeats) {
                block = "Centre";
                x = -4.8 + (seatNumber - leftSeats - 1) * spacing;
            } else {
                block = "Right";
                x = 7.7 + (seatNumber - leftSeats - centerSeats - 1) * spacing;
            }
            const curvedZ = z + rowIndex * 0.72 + Math.abs(x) * 0.018;
            const premium = premiumRows.includes(rowIndex) && block === "Centre";
            const isAccessible = accessible && rowIndex === 4 && block === "Centre"
                && [2, 3].includes(seatNumber - leftSeats);
            const seat = makeSeat(layout, section, row, seatNumber, x, y + rowIndex * rowRise, curvedZ, premium, false);
            seat.category = isAccessible ? "standard" : seat.category;
            seat.accessible = isAccessible;
            seat.unavailable = (rowIndex * 37 + seatNumber * 13 + section.length) % 97 === 0;
            seats.push(seat);
        }
    });
}

function createLayout(layout) {
    const seats = [];
    if (layout === "imax") {
        const rows = ["U", "T", "S", "R", "Q", "P", "O", "N", "M", "L", "K", "J", "H", "G", "F", "E", "D", "C", "B", "A", "V", "W", "X"];
        addThreeBlocks(seats, {
            layout, section: "IMAX", rows, z: -8.8, spacing: 0.61,
            count: (index) => index < 10 ? 28 : index < 20 ? 30 : 26,
            premiumRows: [8, 9, 10, 11, 12], accessible: true
        });
    } else if (layout === "orchestra") {
        addThreeBlocks(seats, {
            layout, section: "Orchestra",
            rows: ["CC", "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X"],
            z: -11, spacing: 0.61, count: (index) => index < 8 ? 30 : 34,
            premiumRows: [6, 7, 8, 9, 10]
        });
        addThreeBlocks(seats, {
            layout, section: "Mezzanine", rows: ["A", "B", "C", "D", "E", "F"],
            y: 3.3, z: -3.2, spacing: 0.64, rowRise: 0.055, count: 28, premiumRows: [0, 1, 2]
        });
        addThreeBlocks(seats, {
            layout, section: "Balcony", rows: ["A", "B", "C", "D", "E", "F", "G", "H"],
            y: 6.4, z: -1.6, spacing: 0.67, rowRise: 0.04, count: 26
        });
    } else {
        addThreeBlocks(seats, {
            layout, section: "Standard",
            rows: ["AA", "BB", "CC", "DD", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"],
            z: -8, spacing: 0.66, count: (index) => index < 4 ? 22 : 24,
            premiumRows: [9, 10, 11], accessible: true
        });
    }
    return seats;
}

function currency(amount) {
    return `₹${amount.toLocaleString("en-IN")}`;
}

function updateSelection() {
    const selected = currentSeats.filter((seat) => selectedSeatIds.has(seat.id));
    const tickets = selected.reduce((sum, seat) => sum + seat.price, 0);
    const fee = selected.length * 15;
    countLabel.textContent = selected.length === 0 ? "No seats selected"
        : `${selected.length} seat${selected.length === 1 ? "" : "s"} selected`;
    ticketCount.textContent = `(${selected.length})`;
    ticketPrice.textContent = currency(tickets);
    feeLabel.textContent = currency(fee);
    totalLabel.textContent = currency(tickets + fee);
    clearButton.disabled = selected.length === 0;
    continueButton.disabled = selected.length === 0 || !bookingEnabled;
    seatList.replaceChildren();

    if (selected.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-selection";
        empty.textContent = "Your seats will appear here";
        seatList.append(empty);
    } else {
        for (const seat of selected) {
            const item = document.createElement("li");
            const name = document.createElement("span");
            name.textContent = `${seat.section} · ${seat.row}${seat.seatNumber}`;
            const price = document.createElement("small");
            price.textContent = currency(seat.price);
            item.append(name, price);
            seatList.append(item);
        }
    }

    renderer?.setSelectedSeats(selectedSeatIds);
}

function changeLayout(layout) {
    activeLayout = layout;
    selectedSeatIds.clear();
    currentSeats = createLayout(layout);
    renderer?.setSeats(currentSeats);
    updateSelection();
    seatTooltip.textContent = `${currentSeats.length.toLocaleString("en-IN")} seats · Click available seats to select`;
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function updateShowtimeOptions() {
    const now = new Date();
    const today = localDateString(now);
    const selectedDate = document.querySelector("#showDate").value;
    document.querySelectorAll(".time-button").forEach((button) => {
        const isPast = selectedDate === today && button.dataset.time <= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        button.disabled = isPast;
        if (button.dataset.time === activeTime && isPast) button.classList.remove("active");
    });
    const availableTimes = [...document.querySelectorAll(".time-button")].filter((button) => !button.disabled);
    if (!availableTimes.some((button) => button.dataset.time === activeTime)) {
        activeTime = availableTimes[0]?.dataset.time ?? "";
    }
    for (const button of document.querySelectorAll(".time-button")) {
        button.classList.toggle("active", !button.disabled && button.dataset.time === activeTime);
    }
    activeDate = selectedDate;
}

async function postForm(url, values) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams(values)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Seatix request failed (${response.status}).`);
    return result;
}

function openPaymentDialog(booking) {
    pendingBooking = booking;
    document.querySelector("#checkoutBookingId").textContent = `#${booking.bookingId}`;
    const showDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" })
        .format(new Date(`${activeDate}T00:00:00`));
    document.querySelector("#checkoutMovie").textContent = `${activeMovie.title} · ${showDate}, ${activeTime}`;
    document.querySelector("#checkoutSeats").textContent = booking.seats.join(", ");
    document.querySelector("#checkoutTotal").textContent = currency(booking.total);
    setPaymentStatus("PENDING", "Payment pending", "No payment has been processed.");
    paymentActions.hidden = false;
    retryPaymentButton.hidden = true;
    closePaymentButton.disabled = true;
    paymentDialog.showModal();
}

function setPaymentStatus(status, title, message) {
    paymentStatusPanel.dataset.status = status;
    paymentStatusTitle.textContent = title;
    paymentStatusMessage.textContent = message;
    document.querySelector("#paymentStatusIcon").textContent =
        status === "SUCCESS" ? "✓" : status === "FAILED" ? "!" : "…";
}

async function simulatePayment(outcome) {
    if (!pendingBooking) return;
    for (const button of paymentActions.querySelectorAll("button")) button.disabled = true;
    paymentStatusMessage.textContent = "Updating the payment record…";
    try {
        const result = await postForm(`/api/bookings/${pendingBooking.bookingId}/payment`, { outcome });
        pendingBooking.paymentStatus = result.paymentStatus;
        if (result.paymentStatus === "SUCCESS" && result.bookingStatus === "CONFIRMED") {
            setPaymentStatus("SUCCESS", "Payment successful · booking confirmed", "Your simulated payment is recorded. No money was moved.");
            for (const seat of currentSeats) {
                if (selectedSeatIds.has(seat.id)) seat.unavailable = true;
            }
            selectedSeatIds.clear();
            updateSelection();
            paymentActions.hidden = true;
            retryPaymentButton.hidden = true;
        } else if (result.paymentStatus === "FAILED") {
            const expired = result.bookingStatus === "CANCELLED" && outcome === "success";
            setPaymentStatus("FAILED", expired ? "Checkout expired · no charge made" : "Payment failed · no charge made",
                expired ? "This pending checkout expired. Your seats have been released." : "Your payment is recorded as failed and the seats have been released.");
            paymentActions.hidden = true;
            retryPaymentButton.hidden = false;
        } else {
            throw new Error("The payment status returned by Seatix was not final.");
        }
        closePaymentButton.disabled = false;
        showToast(`Booking #${result.bookingId}: payment ${result.paymentStatus.toLowerCase()}.`);
    } catch (error) {
        paymentStatusMessage.textContent = error.message;
        showToast(error.message);
        for (const button of paymentActions.querySelectorAll("button")) button.disabled = false;
    }
}

function selectSeat(seat) {
    if (seat.unavailable) {
        showToast("That seat is marked unavailable in this sample layout.");
        return;
    }
    if (selectedSeatIds.has(seat.id)) selectedSeatIds.delete(seat.id);
    else selectedSeatIds.add(seat.id);
    updateSelection();
}

function connectServiceStatus() {
    const status = document.querySelector("#serviceStatus");
    fetch("/api/health")
        .then((response) => {
            if (!response.ok) throw new Error(`Seatix server returned ${response.status}`);
            return response.json();
        })
        .then((data) => {
            if (data.status !== "ok") {
                status.textContent = "View-only demo · booking disabled";
                bookingAvailability.textContent = "Bookings are disabled in this public demo.";
                return;
            }
            bookingEnabled = data.database === "connected";
            status.textContent = bookingEnabled
                ? "MySQL connected · simulated payments"
                : "View-only demo · booking disabled";
            bookingAvailability.textContent = bookingEnabled
                ? "Booking checkout is available; payments are simulated."
                : "Bookings are disabled in this public demo.";
            updateSelection();
        })
        .catch(() => {
            bookingEnabled = false;
            status.textContent = "View-only demo · booking disabled";
            bookingAvailability.textContent = "Bookings are disabled in this public demo.";
            updateSelection();
        });
}

renderMovieShelf();

const showDateInput = document.querySelector("#showDate");
showDateInput.min = localDateString();
const localTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
const hasShowtimeToday = [...document.querySelectorAll(".time-button")].some((button) => button.dataset.time > localTime);
const defaultShowDate = new Date();
if (!hasShowtimeToday) defaultShowDate.setDate(defaultShowDate.getDate() + 1);
showDateInput.value = localDateString(defaultShowDate);
updateShowtimeOptions();
showDateInput.addEventListener("change", updateShowtimeOptions);

document.querySelectorAll(".time-button").forEach((button) => {
    button.addEventListener("click", () => {
        activeTime = button.dataset.time;
        document.querySelectorAll(".time-button").forEach((item) => item.classList.toggle("active", item === button));
    });
});

layoutPicker.addEventListener("change", () => changeLayout(layoutPicker.value));
clearButton.addEventListener("click", () => {
    selectedSeatIds.clear();
    updateSelection();
});
continueButton.addEventListener("click", () => {
    if (!bookingEnabled) return;
    const seats = currentSeats.filter((seat) => selectedSeatIds.has(seat.id));
    if (seats.length === 0) return;
    contactFormError.hidden = true;
    contactFormError.textContent = "";
    contactDialog.showModal();
    document.querySelector("#contactPhone").focus();
});

contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const seats = currentSeats.filter((seat) => selectedSeatIds.has(seat.id));
    if (seats.length === 0) {
        contactDialog.close();
        showToast("Select at least one seat to continue.");
        return;
    }
    const submitLabel = createBookingButton.innerHTML;
    createBookingButton.disabled = true;
    createBookingButton.textContent = "Creating booking…";
    continueButton.disabled = true;
    const form = {
        movie: activeMovie.title,
        layout: activeLayout,
        date: activeDate,
        time: activeTime,
        phone: document.querySelector("#contactPhone").value.trim(),
        email: document.querySelector("#contactEmail").value.trim(),
        seats: seats.map((seat) => `${seat.section}:${seat.row}:${seat.seatNumber}`).join(",")
    };
    try {
        const booking = await postForm("/api/bookings", form);
        contactDialog.close();
        openPaymentDialog(booking);
    } catch (error) {
        contactFormError.textContent = error.message;
        contactFormError.hidden = false;
        showToast(error.message);
    } finally {
        createBookingButton.disabled = false;
        createBookingButton.innerHTML = submitLabel;
        updateSelection();
    }
});

const referenceDialog = document.querySelector("#referenceDialog");
document.querySelector("#referencesButton").addEventListener("click", () => referenceDialog.showModal());
document.querySelector("#referencesButtonBottom").addEventListener("click", () => referenceDialog.showModal());
document.querySelector("#closeDialog").addEventListener("click", () => referenceDialog.close());
document.querySelector("#closeContactDialog").addEventListener("click", () => contactDialog.close());
document.querySelector("#cancelContactDialog").addEventListener("click", () => contactDialog.close());
document.querySelector("#simulatePaymentSuccess").addEventListener("click", () => simulatePayment("success"));
document.querySelector("#simulatePaymentFailure").addEventListener("click", () => simulatePayment("failed"));
retryPaymentButton.addEventListener("click", () => {
    paymentDialog.close();
    pendingBooking = null;
});
closePaymentButton.addEventListener("click", () => {
    if (pendingBooking?.paymentStatus === "PENDING") return;
    paymentDialog.close();
    pendingBooking = null;
});
paymentDialog.addEventListener("cancel", (event) => {
    if (pendingBooking?.paymentStatus === "PENDING") event.preventDefault();
    else pendingBooking = null;
});

try {
    renderer = new SeatixRenderer(document.querySelector("#auditoriumCanvas"), {
        onSeatClick: selectSeat,
        onSeatHover: (seat) => {
            seatTooltip.textContent = seat
                ? `${seat.section} · Row ${seat.row} · Seat ${seat.seatNumber} · ${currency(seat.price)}${seat.unavailable ? " · Unavailable" : ""}`
                : "Drag to look around · Click a seat to select";
        }
    });
    renderer.setMovie(activeMovie);
    changeLayout(activeLayout);
    document.querySelector("#zoomIn").addEventListener("click", () => renderer.zoom(-3));
    document.querySelector("#zoomOut").addEventListener("click", () => renderer.zoom(3));
    document.querySelector("#resetCamera").addEventListener("click", () => renderer.resetCamera());
} catch (error) {
    seatTooltip.textContent = "WebGL could not start. Enable hardware acceleration or try a WebGL-compatible browser.";
    document.querySelector("#serviceStatus").textContent = "3D rendering unavailable";
    console.error("Could not initialize the Seatix 3D auditorium.", error);
}

connectServiceStatus();
