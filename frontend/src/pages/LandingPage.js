import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Zap, Users, BarChart3, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingPage = () => {
  const features = [
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: "Interactive Walkthroughs",
      description: "Create step-by-step guides with rich media and interactive elements"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Easy Builder",
      description: "Form-based or drag-and-drop builder for creating guides effortlessly"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Multi-Tenant",
      description: "Each company gets their own branded portal with complete isolation"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Analytics Dashboard",
      description: "Track views, completions, and drop-off rates with detailed insights"
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Embeddable",
      description: "Embed walkthroughs anywhere with iframe or JS widget"
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "Privacy Control",
      description: "Public, private, or password-protected walkthroughs"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-primary" />
            <span className="text-xl font-heading font-bold">InterGuide</span>
          </div>
          <div className="flex gap-3">
            <Link to="/login">
              <Button variant="ghost" data-testid="nav-login-button">Login</Button>
            </Link>
            <Link to="/signup">
              <Button data-testid="nav-signup-button">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-5xl lg:text-6xl font-heading font-bold text-slate-900 mb-6 tracking-tight">
              Create Interactive Walkthroughs
              <span className="text-primary block mt-2">That Users Actually Follow</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Build beautiful, step-by-step guides with rich media. Track engagement, gather feedback, and help your users succeed.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="rounded-full px-8" data-testid="hero-get-started-button">
                  Get Started Free
                </Button>
              </Link>
              <Button size="lg" variant="secondary" className="rounded-full px-8" data-testid="hero-view-demo-button">
                View Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-heading font-bold text-slate-900 mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-slate-600">
              Powerful features to create, manage, and optimize your walkthroughs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-12 text-center"
          >
            <h2 className="text-4xl font-heading font-bold text-slate-900 mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Join companies creating better user experiences with interactive walkthroughs
            </p>
            <Link to="/signup">
              <Button size="lg" className="rounded-full px-8" data-testid="cta-get-started-button">
                Start Building Now
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="text-xl font-heading font-bold text-white">InterGuide</span>
          </div>
          <p>© 2025 InterGuide. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;