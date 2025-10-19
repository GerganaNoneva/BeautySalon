import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, DollarSign, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { router, useLocalSearchParams } from 'expo-router';

type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
};

type Promotion = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
};

export default function ClientPricingScreen() {
  const { highlightPromotionId } = useLocalSearchParams<{ highlightPromotionId?: string }>();
  const [services, setServices] = useState<Service[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [highlightedPromotionId, setHighlightedPromotionId] = useState<string | null>(null);
  const promotionRefs = useRef<{ [key: string]: View | null }>({});
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadServices();
    loadPromotions();
  }, []);

  useEffect(() => {
    if (highlightPromotionId && promotions.length > 0) {
      setTimeout(() => {
        const promotionRef = promotionRefs.current[highlightPromotionId];
        if (promotionRef && scrollViewRef.current) {
          promotionRef.measureLayout(
            scrollViewRef.current as any,
            (x, y) => {
              scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
              setHighlightedPromotionId(highlightPromotionId);
              setTimeout(() => setHighlightedPromotionId(null), 3000);
            },
            () => {}
          );
        }
      }, 300);
    }
  }, [highlightPromotionId, promotions]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('Error loading promotions:', error);
    }
  };

  const handleServiceSelect = (service: Service) => {
    router.push({
      pathname: '/(client)/booking',
      params: { selectedServiceId: service.id }
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Ценоразпис</Text>
        <Text style={styles.headerSubtitle}>Нашите услуги</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView ref={scrollViewRef} style={styles.content}>
          <View style={styles.infoBox}>
            <Calendar size={24} color={theme.colors.primary} />
            <Text style={styles.infoText}>Изберете услуга, за да видите повече информация. За резервация използвайте раздел "Заяви час"</Text>
          </View>

          {promotions.length > 0 && (
            <View style={styles.promotionsSection}>
              <Text style={styles.sectionTitle}>Промоции</Text>
              {promotions.map((promotion) => (
                <View
                  key={promotion.id}
                  ref={(ref) => (promotionRefs.current[promotion.id] = ref)}
                  style={[
                    styles.promotionCard,
                    highlightedPromotionId === promotion.id && styles.promotionCardHighlight,
                  ]}
                >
                  <View style={styles.promotionHeader}>
                    <Text style={styles.promotionName}>{promotion.name}</Text>
                    <View style={styles.promotionPriceTag}>
                      <DollarSign size={16} color={theme.colors.surface} />
                      <Text style={styles.promotionPrice}>{promotion.price} лв</Text>
                    </View>
                  </View>
                  {promotion.description && (
                    <Text style={styles.promotionDescription}>{promotion.description}</Text>
                  )}
                  <View style={styles.promotionFooter}>
                    <Clock size={16} color={theme.colors.textMuted} />
                    <Text style={styles.promotionDuration}>{promotion.duration_minutes} мин</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Услуги</Text>

          {services.length === 0 ? (
            <View style={styles.emptyState}>
              <DollarSign size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyStateText}>Все още няма добавени услуги</Text>
            </View>
          ) : (
            services.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={styles.serviceCard}
                onPress={() => handleServiceSelect(service)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={theme.gradients.secondary}
                  style={styles.serviceGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {service.image_url && (
                    <Image
                      source={{ uri: service.image_url }}
                      style={styles.serviceImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.serviceContent}>
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <View style={styles.priceTag}>
                        <Text style={styles.priceText}>{service.price.toFixed(2)} лв</Text>
                      </View>
                    </View>

                    {service.description && (
                      <Text style={styles.serviceDescription}>{service.description}</Text>
                    )}

                    <View style={styles.serviceMeta}>
                      <View style={styles.metaItem}>
                        <Clock size={16} color={theme.colors.surface} />
                        <Text style={styles.metaText}>{service.duration_minutes} минути</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}

          <View style={styles.footerInfo}>
            <Text style={styles.footerTitle}>Как да запазя час?</Text>
            <Text style={styles.footerText}>
              1. Отидете на раздел "Заяви час"{'\n'}
              2. Натиснете "Нова заявка за час"{'\n'}
              3. Опишете какво желаете{'\n'}
              4. Очаквайте потвърждение от салона
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.8,
    marginTop: theme.spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingTop: theme.spacing.lg,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  infoText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    lineHeight: 20,
  },
  promotionsSection: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  promotionCard: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  promotionCardHighlight: {
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.warning,
    transform: [{ scale: 1.02 }],
  },
  promotionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  promotionName: {
    flex: 1,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.surface,
    marginRight: theme.spacing.md,
  },
  promotionPriceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  promotionPrice: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  promotionDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.9,
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  promotionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  promotionDuration: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyStateText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  serviceCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  serviceGradient: {
    padding: theme.spacing.lg,
  },
  serviceImage: {
    width: '100%',
    height: 150,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  serviceContent: {
    gap: theme.spacing.sm,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  serviceName: {
    flex: 1,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  priceTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.round,
  },
  priceText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  serviceDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.9,
    lineHeight: 20,
  },
  serviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    fontWeight: '500',
    opacity: 0.9,
  },
  footerInfo: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  footerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
  },
  footerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    lineHeight: 24,
  },
});
