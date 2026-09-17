"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Clock, MessageSquare, ExternalLink } from "lucide-react";
import Link from "next/link";

export function PrivacyPolicyContact() {
  const contactMethods = [
    {
      icon: Mail,
      title: "Privacy Officer",
      description:
        "Contact our dedicated privacy officer for data protection inquiries",
      contact: "privacy@insidekarachi.com",
      action: "mailto:privacy@insidekarachi.com",
      color: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
      borderColor: "border-blue-500/30",
      iconColor: "text-blue-500",
    },
    {
      icon: MessageSquare,
      title: "Data Subject Requests",
      description: "Submit requests for data access, correction, or deletion",
      contact: "Privacy Request Form",
      action: "/contact?subject=privacy",
      color: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      borderColor: "border-emerald-500/30",
      iconColor: "text-emerald-500",
    },
    {
      icon: Phone,
      title: "General Support",
      description:
        "Get help with account settings, technical issues, or general inquiries",
      contact: "support@insidekarachi.com",
      action: "mailto:support@insidekarachi.com",
      color: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      borderColor: "border-purple-500/30",
      iconColor: "text-purple-500",
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

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-32 bg-gradient-to-br from-primary/5 via-background to-primary/10 relative overflow-hidden">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:50px_50px]"
        aria-hidden
      />

      {/* Decorative Orbs */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="max-w-6xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Section Header */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <Badge className="px-6 py-3 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 mb-6">
              <MessageSquare className="h-4 w-4 mr-2" />
              Contact & Compliance
            </Badge>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Questions About Your{" "}
              <span className="gradient-text-primary">Privacy</span>
            </h2>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              If you have questions about this privacy policy, our data
              practices, or wish to exercise your privacy rights, please contact
              us using the methods below. We are committed to addressing your
              concerns promptly.
            </p>
          </motion.div>

          {/* Contact Methods Grid */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16"
          >
            {contactMethods.map((method, _index) => (
              <motion.div
                key={method.title}
                variants={itemVariants}
                whileHover={{ y: -5 }}
                className={`relative p-8 rounded-2xl border bg-background/95 bg-gradient-to-br ${method.color} ${method.borderColor} group transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1`}
              >
                {/* Icon */}
                <div
                  className={`inline-flex p-4 rounded-xl bg-background/95 border ${method.borderColor} mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                >
                  <method.icon className={`h-6 w-6 ${method.iconColor}`} />
                </div>

                {/* Content */}
                <h3 className="text-base sm:text-lg font-semibold mb-3 text-foreground">
                  {method.title}
                </h3>

                <p className="text-muted-foreground mb-4 leading-relaxed">
                  {method.description}
                </p>

                {/* Contact Info */}
                <div className="space-y-2">
                  <p className="font-medium text-foreground">
                    {method.contact}
                  </p>
                </div>

                {/* Action Button */}
                <div className="mt-6">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full border-primary/30 hover:bg-primary/5 group/btn"
                  >
                    {method.action.startsWith("mailto:") ? (
                      <a
                        href={method.action}
                        className="inline-flex items-center"
                      >
                        Send Email
                        <ExternalLink className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </a>
                    ) : method.action.startsWith("tel:") ? (
                      <a
                        href={method.action}
                        className="inline-flex items-center"
                      >
                        Call Now
                        <ExternalLink className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </a>
                    ) : (
                      <Link
                        href={method.action}
                        className="inline-flex items-center"
                      >
                        Submit Request
                        <ExternalLink className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    )}
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Additional Information */}
          <motion.div variants={itemVariants} className="text-center">
            <div className="max-w-4xl mx-auto p-8 rounded-2xl bg-background/95 border border-border/50">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">
                  Response Time
                </span>
              </div>

              <p className="text-muted-foreground mb-6">
                We respond to privacy-related inquiries within 5-10 business
                days. Data subject requests are typically processed within 30
                days as required by applicable privacy regulations.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8">
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Privacy inquiries: 5-10 business days</span>
                </div>

                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>Data requests: Within 30 days</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Footer Note */}
          <motion.div variants={itemVariants} className="text-center mt-16">
            <p className="text-sm text-muted-foreground">
              This privacy policy was last updated on September 16, 2026. We
              regularly review and update our privacy practices to ensure
              compliance with evolving data protection regulations.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
