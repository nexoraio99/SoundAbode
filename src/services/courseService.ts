export interface CourseItem {
  id: string;
  slug: string;
  title: string;
  category: 'EMP' | 'DJ' | 'ENGINEERING';
  duration: string;
  level: string;
  price: string;
  description: string;
  status: 'OPEN' | 'FILLING FAST' | 'WAITLIST';
  modulesCount: number;
  featured?: boolean;
}

const INITIAL_COURSES: CourseItem[] = [
  {
    id: 'course-1',
    slug: 'level-1-emp-beginner',
    title: 'Level 1: Electronic Music Production Beginner',
    category: 'EMP',
    duration: '2 Months (32 Hours)',
    level: 'Beginner',
    price: '₹25,000',
    description: 'Master Ableton Live 12 basics, MIDI arrangement, drum pattern programming, and foundational music theory.',
    status: 'OPEN',
    modulesCount: 8,
    featured: true,
  },
  {
    id: 'course-2',
    slug: 'level-2-sound-design-synthesis',
    title: 'Level 2: Advanced Sound Design & Synthesis',
    category: 'EMP',
    duration: '2 Months (32 Hours)',
    level: 'Intermediate',
    price: '₹35,000',
    description: 'Subtractive, FM, and Wavetable synthesis, Serum / Vital patch design, and custom sample creation.',
    status: 'FILLING FAST',
    modulesCount: 10,
    featured: true,
  },
  {
    id: 'course-3',
    slug: 'level-3-mixing-mastering',
    title: 'Level 3: Audio Engineering, Mixing & Mastering',
    category: 'ENGINEERING',
    duration: '3 Months (48 Hours)',
    level: 'Advanced',
    price: '₹45,000',
    description: 'Acoustics, parametric EQ, multiband compression, gain staging, analog processing, and streaming loudness.',
    status: 'OPEN',
    modulesCount: 12,
    featured: true,
  },
  {
    id: 'course-4',
    slug: 'pioneer-pro-dj-performance',
    title: 'Pioneer Pro DJ Performance Masterclass',
    category: 'DJ',
    duration: '1.5 Months (24 Hours)',
    level: 'All Levels',
    price: '₹30,000',
    description: 'Tactile training on flagship Pioneer CDJ-3000 decks, Rekordbox library prep, beatmatching by ear, and live set phrasing.',
    status: 'OPEN',
    modulesCount: 6,
    featured: true,
  },
  {
    id: 'course-5',
    slug: 'emp-diploma-audio-engineering-all-levels',
    title: 'Diploma in Audio Engineering (All Four Levels Together)',
    category: 'EMP',
    duration: '13 Months',
    level: 'Comprehensive',
    price: '₹2,40,000',
    description: 'Complete 4-level comprehensive program combining Beginner, Intermediate, Diploma Audio Engineering, and Mixing & Mastering with Studio Internship.',
    status: 'OPEN',
    modulesCount: 40,
    featured: true,
  },
];

const LOCAL_STORAGE_KEY = 'soundabode_courses_data';

export class CourseService {
  private static getStoredCourses(): CourseItem[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback if localStorage unavailable
    }
    return INITIAL_COURSES;
  }

  private static saveCourses(courses: CourseItem[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(courses));
    } catch {
      // Fallback
    }
  }

  public static getAllCourses(): CourseItem[] {
    return this.getStoredCourses();
  }

  public static getCourseById(id: string): CourseItem | undefined {
    return this.getStoredCourses().find((c) => c.id === id);
  }

  public static addCourse(course: Omit<CourseItem, 'id'>): CourseItem {
    const courses = this.getStoredCourses();
    const newCourse: CourseItem = {
      ...course,
      id: `course-${Date.now()}`,
    };
    const updated = [newCourse, ...courses];
    this.saveCourses(updated);
    return newCourse;
  }

  public static updateCourse(id: string, updatedFields: Partial<CourseItem>): CourseItem | null {
    const courses = this.getStoredCourses();
    const index = courses.findIndex((c) => c.id === id);
    if (index === -1) return null;

    courses[index] = { ...courses[index], ...updatedFields };
    this.saveCourses(courses);
    return courses[index];
  }

  public static deleteCourse(id: string): boolean {
    let courses = this.getStoredCourses();
    const initialLength = courses.length;
    courses = courses.filter((c) => c.id !== id);
    if (courses.length !== initialLength) {
      this.saveCourses(courses);
      return true;
    }
    return false;
  }

  public static resetToDefault(): CourseItem[] {
    this.saveCourses(INITIAL_COURSES);
    return INITIAL_COURSES;
  }
}
