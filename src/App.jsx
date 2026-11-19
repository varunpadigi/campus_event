
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

function App() {
  const [events, setEvents] = useState([]);
  const [registered, setRegistered] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [studentEmail, setStudentEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // My Registrations states
  const [lookupEmail, setLookupEmail] = useState("");
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupDone, setLookupDone] = useState(false);

  // Load events from Supabase
  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*");

      if (fetchError) {
        console.error("Error loading events:", fetchError);
        setError("Unable to load events. Please refresh the page.");
        setEvents([]);
      } else {
        setEvents(data ?? []);
      }

      setLoading(false);
    }

    loadEvents();
  }, []);

  // Create category filters from the available events
  const categories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(
        events
          .map((event) => event.category)
          .filter(Boolean)
      ),
    ];

    return ["All", ...uniqueCategories];
  }, [events]);

  // Filter events by search text and category
  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch = [
        event.title,
        event.description,
        event.venue,
        event.category,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      );

      const matchesCategory =
        selectedCategory === "All" ||
        event.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [events, searchTerm, selectedCategory]);

  // Register for an event
  async function handleRegister(event) {
    const email = studentEmail.trim().toLowerCase();

    setError("");
    setSuccessMessage("");

    if (!email) {
      setError("Please enter your email address before registering.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (registered.includes(event.id)) {
      setSuccessMessage("You have already registered for this event in this session.");
      return;
    }

    setRegisteringId(event.id);

    try {
      const { error: insertError } = await supabase
        .from("registrations")
        .insert([
          {
            event_id: event.id,
            student_email: email,
          },
        ]);

      if (insertError) {
        console.error("Registration error:", insertError);

        if (insertError.code === "23505") {
          setError("A registration for this event already exists.");
        } else {
          setError(
            `Registration failed: ${insertError.message}`
          );
        }

        return;
      }

      setRegistered((previous) => [...previous, event.id]);
      setStudentEmail(email);
      setSuccessMessage(
        `Successfully registered for ${event.title}!`
      );

      // Refresh My Registrations if the lookup uses this email.
      if (
        lookupDone &&
        lookupEmail.trim().toLowerCase() === email
      ) {
        await handleFindRegistrations(email);
      }
    } catch (err) {
      console.error("Unexpected registration error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setRegisteringId(null);
    }
  }

  // Find registrations using an email address
  async function handleFindRegistrations(emailToFind) {
    const email = (
      typeof emailToFind === "string"
        ? emailToFind
        : lookupEmail
    )
      .trim()
      .toLowerCase();

    setLookupError("");
    setLookupDone(false);
    setMyRegistrations([]);

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailPattern.test(email)) {
      setLookupError("Please enter a valid email address.");
      return;
    }

    setLookupEmail(email);
    setLookupLoading(true);

    try {
      const { data, error: queryError } = await supabase
        .from("registrations")
        .select("event_id")
        .eq("student_email", email);

      if (queryError) {
        console.error("Registration lookup error:", queryError);

        setLookupError(
          "We couldn't retrieve your registrations. Supabase may be blocking this request because of its Row Level Security (RLS) policies. Check the database permissions and email verification setup."
        );

        return;
      }

      // Match registration event IDs with the events already loaded.
      const eventIds = new Set(
        (data ?? []).map((registration) =>
          String(registration.event_id)
        )
      );

      const matchingEvents = events.filter((event) =>
        eventIds.has(String(event.id))
      );

      setMyRegistrations(matchingEvents);
      setLookupDone(true);
    } catch (err) {
      console.error("Unexpected lookup error:", err);
      setLookupError(
        "An unexpected error occurred while finding registrations."
      );
    } finally {
      setLookupLoading(false);
    }
  }

  function getEventIcon(event) {
    if (event.icon) return event.icon;

    const category = (event.category ?? "").toLowerCase();

    if (category.includes("workshop")) return "💻";
    if (category.includes("competition")) return "🏆";
    if (category.includes("cultural")) return "🎭";

    return "🎓";
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="container">
          <h1>CampusConnect</h1>
          <p className="tagline">
            Your campus. Your events. Your community.
          </p>

          <p className="hero-description">
            Discover campus events, explore activities, and
            register for opportunities happening on your campus.
          </p>
        </div>
      </header>

      <main className="container">
        {/* Discover events */}
        <section className="section">
          <h2>Discover Campus Events</h2>
          <p>
            Find events, explore activities, and register for
            opportunities happening on your campus.
          </p>

          <div className="search-box">
            <input
              type="search"
              placeholder="Search events, venues, or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search campus events"
            />
          </div>

          <div className="category-filters">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={
                  selectedCategory === category
                    ? "filter-btn active"
                    : "filter-btn"
                }
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        {/* My Registrations */}
        <section className="section registrations-section">
          <h2>My Registrations</h2>
          <p>Find events registered with your email.</p>

          <form
            className="lookup-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleFindRegistrations(lookupEmail);
            }}
          >
            <input
              type="email"
              placeholder="Enter your registered email"
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              required
              aria-label="Email used for registration"
            />

            <button
              type="submit"
              className="primary-btn"
              disabled={lookupLoading}
            >
              {lookupLoading
                ? "Searching..."
                : "Find My Registrations"}
            </button>
          </form>

          {lookupError && (
            <p className="error-message" role="alert">
              {lookupError}
            </p>
          )}

          {lookupDone && myRegistrations.length === 0 && (
            <p className="info-message">
              No registrations found for this email.
            </p>
          )}

          {lookupDone && myRegistrations.length > 0 && (
            <div className="my-registrations-list">
              <h3>
                Found {myRegistrations.length}{" "}
                {myRegistrations.length === 1
                  ? "registration"
                  : "registrations"}
              </h3>

              <div className="event-grid">
                {myRegistrations.map((event) => (
                  <article
                    className="event-card"
                    key={event.id}
                  >
                    <div className="event-icon">
                      {getEventIcon(event)}
                    </div>

                    <span className="event-category">
                      {event.category || "Campus Event"}
                    </span>

                    <h3>{event.title}</h3>

                    <p>{event.description}</p>

                    <p>
                      <strong>Date:</strong>{" "}
                      {event.date
                        ? new Date(event.date).toLocaleDateString()
                        : "To be announced"}
                    </p>

                    <p>
                      <strong>Venue:</strong>{" "}
                      {event.venue || "To be announced"}
                    </p>

                    <span className="registered-label">
                      Registered ✓
                    </span>
                  </article>
                ))}
              </div>
            </div>
          )}

          <p className="privacy-note">
            Demo limitation: an email address alone does not
            verify ownership. Secure private registration lookup
            requires email authentication and appropriate RLS
            policies.
          </p>
        </section>

        {/* Upcoming Events */}
        <section className="section">
          <h2>Upcoming Events</h2>

          {!loading && !error && (
            <p>{filteredEvents.length} events found</p>
          )}

          {loading && (
            <p className="info-message">Loading events...</p>
          )}

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          {!loading && !error && filteredEvents.length === 0 && (
            <p className="info-message">
              No events match your search. Try another keyword
              or category.
            </p>
          )}

          <div className="event-grid">
            {filteredEvents.map((event) => {
              const isRegistered = registered.includes(event.id);
              const isRegistering = registeringId === event.id;

              return (
                <article
                  className="event-card"
                  key={event.id}
                >
                  <div className="event-icon">
                    {getEventIcon(event)}
                  </div>

                  <span className="event-category">
                    {event.category || "Campus Event"}
                  </span>

                  <h3>{event.title}</h3>

                  <p>{event.description}</p>

                  <p>
                    <strong>Date:</strong>{" "}
                    {event.date
                      ? new Date(event.date).toLocaleDateString()
                      : "To be announced"}
                  </p>

                  <p>
                    <strong>Venue:</strong>{" "}
                    {event.venue || "To be announced"}
                  </p>

                  {isRegistered ? (
                    <button
                      type="button"
                      className="register-btn registered-btn"
                      disabled
                    >
                      Registered ✓
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="register-btn"
                      disabled={isRegistering}
                      onClick={() => handleRegister(event)}
                    >
                      {isRegistering
                        ? "Registering..."
                        : "Register Now"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          {successMessage && (
            <p className="success-message" role="status">
              {successMessage}
            </p>
          )}

          {error && !loading && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <div className="registration-form">
            <label htmlFor="student-email">
              Student email for registration
            </label>

            <input
              id="student-email"
              type="email"
              placeholder="Enter your email before registering"
              value={studentEmail}
              onChange={(e) => {
                setStudentEmail(e.target.value);
                setError("");
                setSuccessMessage("");
              }}
            />

            <p className="input-hint">
              Enter your email here, then select Register Now on
              the event you want to attend.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          © 2026 CampusConnect | Campus Event Portal
        </p>
      </footer>
    </div>
  );
}

export default App;
