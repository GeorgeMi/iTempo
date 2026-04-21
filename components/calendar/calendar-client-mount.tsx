"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventInput } from "@fullcalendar/core";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import multiMonthPlugin from "@fullcalendar/multimonth";

export type FullCalendarMountPoint = { api: () => FullCalendar | null };

type Props = {
  events: EventInput[];
  locale: string;
  onDatesSet: (info: { start: Date; end: Date }) => void;
  onDateSelect: (info: { start: Date; end: Date; allDay: boolean; jsEvent: Event | null }) => void;
  onEventClick: (arg: any) => void;
  onEventChange: (arg: any) => void;
};

export const CalendarClientMount = forwardRef<FullCalendarMountPoint, Props>(function CalendarClientMount(
  { events, locale, onDatesSet, onDateSelect, onEventClick, onEventChange },
  ref,
) {
  const cal = useRef<FullCalendar | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useImperativeHandle(ref, () => ({ api: () => cal.current }));

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <FullCalendar
      ref={cal}
      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, multiMonthPlugin]}
      initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
      headerToolbar={{
        left: isMobile ? "prev,next" : "prev,next today",
        center: "title",
        right: isMobile
          ? "timeGridDay,timeGridWeek"
          : "timeGridDay,timeGridWeek,dayGridMonth,multiMonthYear",
      }}
      buttonText={
        locale === "ro"
          ? { today: "Azi", day: "Zi", week: "Săpt.", month: "Lună", year: "An" }
          : { today: "Today", day: "Day", week: "Week", month: "Month", year: "Year" }
      }
      locale={locale}
      firstDay={1}
      height="auto"
      contentHeight="auto"
      expandRows
      nowIndicator
      slotMinTime="07:00:00"
      slotMaxTime="22:00:00"
      slotDuration="00:30:00"
      slotLabelInterval="01:00:00"
      allDaySlot={false}
      eventOverlap
      selectable
      selectMirror
      editable
      eventDurationEditable
      longPressDelay={300}
      selectLongPressDelay={300}
      eventLongPressDelay={300}
      dayMaxEvents
      events={events}
      datesSet={onDatesSet}
      select={onDateSelect}
      eventClick={onEventClick}
      eventDrop={onEventChange}
      eventResize={onEventChange}
    />
  );
});
