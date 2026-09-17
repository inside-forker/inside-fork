"use client";

import { motion } from "framer-motion";
import { Database, Users, Shield, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function PrivacyPolicyContent() {
  const sections = [
    {
      id: "information-collection",
      icon: Database,
      title: "Information We Collect",
      color: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
      borderColor: "border-blue-500/30",
      iconColor: "text-blue-500",
      description:
        "We collect only what the app and website need to work, and we tell you what each permission is for.",
      subsections: [
        {
          title: "Account Information",
          content:
            "Your name, email address, phone number, profile photo, and — if you sign in with Google or Apple — the basic profile details those services return.",
        },
        {
          title: "Location",
          content:
            "With your permission, your device location, used to show places, events and deals near you. Location is read only while you are using the app, never in the background, and you can turn it off at any time in your device settings.",
        },
        {
          title: "Camera & Photos",
          content:
            "Camera access is used only to scan QR codes at partner venues. Photo access is used only for images you pick yourself, such as a profile picture or photos added to a listing or review.",
        },
        {
          title: "Device & Usage Information",
          content:
            "Device model, operating system, app version and language, plus in-app activity such as screens viewed, searches, saves and reviews.",
        },
        {
          title: "Notifications",
          content:
            "If you allow notifications, a push token for your device so we can send alerts about events, deals and account activity. Turning notifications off removes it.",
        },
        {
          title: "Crash & Performance Data",
          content:
            "Diagnostic reports collected through Sentry when the app crashes or misbehaves, so we can find and fix the problem.",
        },
      ],
    },
    {
      id: "information-usage",
      icon: Users,
      title: "How We Use Your Information",
      color: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      borderColor: "border-emerald-500/30",
      iconColor: "text-emerald-500",
      description:
        "Your information helps us deliver, personalise and improve the service.",
      subsections: [
        {
          title: "Service Delivery",
          content:
            "To provide listings, events, tickets, card deals, reviews and the other features of the app and website.",
        },
        {
          title: "Personalisation",
          content:
            "To recommend places, events and deals near you, and to keep track of your saves, visits and Explorer progress.",
        },
        {
          title: "Communication",
          content:
            "To send service updates, respond to inquiries, provide support and — where you have allowed it — send notifications about events and deals.",
        },
        {
          title: "Platform Improvement",
          content:
            "To analyse usage patterns, diagnose crashes, prevent abuse and develop new features.",
        },
      ],
    },
    {
      id: "data-protection",
      icon: Shield,
      title: "Data Protection & Security",
      color: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      borderColor: "border-purple-500/30",
      iconColor: "text-purple-500",
      description:
        "We implement comprehensive security measures to protect your personal information.",
      subsections: [
        {
          title: "Security Measures",
          content:
            "Industry-standard encryption in transit, secure storage, access controls and regular security reviews.",
        },
        {
          title: "Data Retention",
          content:
            "We keep your information only while your account is active, or as long as needed for the purposes set out in this policy. Deleting your account removes your profile and personal data, except records we are required to keep by law.",
        },
        {
          title: "Third-Party Services",
          content:
            "Sentry (crash and performance reporting), Google and Apple (sign-in), Expo's push notification service (notification delivery), and our hosting providers. Partner promotions shown in the app, such as Parchi, are links only — opening one takes you to the partner's own site, and we do not share your personal data with them.",
        },
      ],
    },
    {
      id: "your-rights",
      icon: Eye,
      title: "Your Rights & Controls",
      color: "from-indigo-500/20 via-indigo-500/10 to-indigo-500/5",
      borderColor: "border-indigo-500/30",
      iconColor: "text-indigo-500",
      description:
        "You have control over your personal information and how it's used.",
      subsections: [
        {
          title: "Access & Portability",
          content:
            "Request a copy of the personal data we hold about you, in a portable format.",
        },
        {
          title: "Correction & Deletion",
          content:
            "Update inaccurate information, or delete your account at any time — in the app from Settings → Delete Account, or on the web at insidekarachi.com/delete-account.",
        },
        {
          title: "Permissions & Preferences",
          content:
            "Location, camera, photo and notification access can each be withdrawn in your device settings, and marketing emails can be turned off at any time, without losing access to the rest of the service.",
        },
      ],
    },
    {
      id: "childrens-privacy",
      icon: FileText,
      title: "Children's Privacy",
      color: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
      borderColor: "border-amber-500/30",
      iconColor: "text-amber-500",
      description:
        "The service is intended for adults and older teens, not for children.",
      subsections: [
        {
          title: "Age Requirement",
          content:
            "You must be at least 13 years old to create an account. The service is not directed to children, and we do not knowingly collect personal information from anyone under 13.",
        },
        {
          title: "Parental Requests",
          content:
            "If you believe a child under 13 has given us personal information, email privacy@insidekarachi.com and we will delete the account and its data.",
        },
      ],
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-6xl mx-auto space-y-16"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div
            variants={sectionVariants}
            className="bg-gradient-to-r from-primary/5 via-background to-primary/5 rounded-2xl p-8 border border-primary/10 shadow-premium-lg bg-background/95"
          >
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-6 flex items-center">
              <FileText className="h-6 w-6 mr-3 text-primary" />
              Table of Contents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center space-x-3 p-4 rounded-lg hover:bg-primary/10 transition-all duration-300 group hover:shadow-md border border-transparent hover:border-primary/20"
                >
                  <section.icon className={`h-5 w-5 ${section.iconColor}`} />
                  <div>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {index + 1}. {section.title}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {section.description}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>

          {/* Main Content Sections */}
          {sections.map((section, sectionIndex) => (
            <motion.div
              key={section.id}
              id={section.id}
              variants={sectionVariants}
              className={cn(
                "relative p-8 sm:p-10 md:p-12 rounded-2xl sm:rounded-3xl border bg-background/95 shadow-premium-lg hover:shadow-premium-xl transition-all duration-300 hover:-translate-y-1",
                `bg-gradient-to-br ${section.color}`,
                section.borderColor
              )}
            >
              {/* Section Header */}
              <div className="flex items-center space-x-4 mb-8">
                <div
                  className={cn(
                    "p-4 rounded-xl bg-background/95 border shadow-lg",
                    section.borderColor
                  )}
                >
                  <section.icon className={cn("h-6 w-6", section.iconColor)} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                    {sectionIndex + 1}. {section.title}
                  </h2>
                  <div className="w-12 h-1 bg-primary rounded-full mt-2" />
                </div>
              </div>

              {/* Section Content */}
              <div className="space-y-6">
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
                  {section.description}
                </p>

                <div className="grid gap-4">
                  {section.subsections.map((subsection, contentIndex) => (
                    <div
                      key={contentIndex}
                      className="bg-background/95 rounded-lg p-6 border border-border/30 shadow-sm hover:shadow-md transition-all duration-300 hover:bg-background/50"
                    >
                      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                        {subsection.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {subsection.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decorative Element */}
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-primary/10 rounded-full blur-xl" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
